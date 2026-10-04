import {vec3} from 'gl-matrix'
import gameplayApi from '../../services/gameplayApi'
import { FactionTeam } from '../manager/nodeManager'
import { NetBotClass, NetSpellType, NetAnimationType, NetSoundType } from './netProtocol'
import { CasterModels } from './serverConfig'
import ServerEntity from './serverEntity'
import CombatManager from './combatManager'
import BotAI from './botAI'
import type ServerConfig from './serverConfig';
import type NodeManager from '../manager/nodeManager';
import type { EntityMap } from './combatManager';
import type { ServerModel } from './serverConfig';
import type { NetSpellTypeValue, NetBotClassValue, WorldSnapshot, NetDamageEvent, NetSpellVisualEvent, NetEntityDied, NetSoundStub } from './netProtocol';

/* start and end within this distance of a cached path's reuse it (NavigationPathCache.PositionTolerance) */
const PositionTolerance = 3.0;

interface PathEntry {
    start: vec3;
    end: vec3;
    /* null while the mpq server calculates it */
    points: vec3[] | null;
}

/* one tick's combat events for the clients */
export interface PendingCombatEvents {
    damage: NetDamageEvent[];
    visuals: NetSpellVisualEvent[];
    deaths: NetEntityDied[];
    sounds: NetSoundStub[];
}

/*
 * The authoritative game world, as my_web_wow's WowServer/ServerWorld.cs: all entities, bot AI, combat,
 * resurrection, and a WorldSnapshot for the clients each tick. The C# loads the nodes from sql and its
 * paths from the navigation library (with a path cache on disk); the web version uses the map's nodes from
 * the scene's NodeManager and the mpq server's navigation api with an in-memory path cache, whose paths
 * arrive asynchronously (calculatePath returns null until then).
 */
class ServerWorld {
    cfg: ServerConfig;
    combat: CombatManager;
    botAI: BotAI;
    nodeManager: NodeManager;

    // All entities (players + bots)
    entities: EntityMap;

    // Navigation (web: the path cache, filled from the mpq server)
    pathCache: PathEntry[];

    // Resurrection timer
    ressTimer: number;

    // Deathmatch scores
    allianceKills: number;
    hordeKills: number;

    // Server time
    serverTime: number;

    constructor(cfg: ServerConfig, nodeManager: NodeManager) {
        this.cfg = cfg;
        this.nodeManager = nodeManager;
        this.combat = new CombatManager(cfg);
        this.botAI = new BotAI(cfg, this.combat, nodeManager);
        this.entities = new Map();
        this.pathCache = [];
        this.ressTimer = cfg.ressurectionInterval;
        this.allianceKills = 0;
        this.hordeKills = 0;
        this.serverTime = 0;
    }

    // ========================= Initialization =========================

    initialize() {
        ServerEntity.resetIdCounter();
        if (this.nodeManager.nodes.length === 0)
            console.log("[world] Map " + this.cfg.mapId + " has no nodes! Bots will not be able to wander.");
        console.log("[world] Initialized for map " + this.cfg.mapId + ", mode=" + (this.cfg.deathmatch ? "Deathmatch" : "FreeForAll") + ", bots=" + this.cfg.botCount);
    }

    // ========================= Player Management =========================

    /* Create a player entity. */
    createPlayer(): ServerEntity {
        var player = new ServerEntity(true);
        player.displayId = this.cfg.playerDisplayId;
        player.modelPath = this.cfg.playerModelPath;
        player.scale = this.cfg.playerScale;
        player.botClass = NetBotClass.Caster; // default, can be changed
        player.initHealth(this.cfg);

        // Assign team in deathmatch
        if (this.cfg.deathmatch)
            player.team = FactionTeam.Alliance; // player always alliance
        else
            player.team = FactionTeam.None; // FFA

        // Spawn at a node
        this.spawnAtNode(player);

        this.entities.set(player.id, player);
        console.log("[world] Player created: id=" + player.id + ", team=" + player.team);
        return player;
    }

    // ========================= Bot Spawning =========================

    spawnBots() {
        var meleeModels = this.cfg.getMeleeModels();
        var allyCount = 0, hordeCount = 0;

        for (var i = 0; i < this.cfg.botCount; i++) {
            // Random class
            var botClass: NetBotClassValue = Math.random() < 0.5 ? NetBotClass.Melee : NetBotClass.Caster;

            // Pick model
            var model: ServerModel;
            if (botClass === NetBotClass.Melee)
                model = meleeModels[Math.floor(Math.random() * meleeModels.length)];
            else
                model = CasterModels[Math.floor(Math.random() * CasterModels.length)];

            var bot = new ServerEntity(false);
            bot.displayId = model[0];
            bot.modelPath = model[1];
            switch (model[0]) {
                case 11121: bot.scale = 0.3; break;   // ragnaros
                case 8570: bot.scale = 0.3; break;    // onyxia
                case 11380: bot.scale = 0.3; break;   // nefarian
                case 20539: bot.scale = 0.8; break;   // netherdrake outland
                case 24725: bot.scale = 0.8; break;   // netherdrake elite
                case 5645: bot.scale = 0.8; break;    // drake
                default: bot.scale = 1; break;
            }
            bot.botClass = botClass;
            bot.initHealth(this.cfg);
            bot.saveOriginalModel();

            // Assign team in deathmatch
            if (this.cfg.deathmatch) {
                if (allyCount <= hordeCount) { bot.team = FactionTeam.Alliance; allyCount++; }
                else { bot.team = FactionTeam.Horde; hordeCount++; }
            } else {
                bot.team = FactionTeam.None;
            }

            this.spawnAtNode(bot);
            this.entities.set(bot.id, bot);
        }

        console.log("[world] Spawned " + this.cfg.botCount + " bots " +
            (this.cfg.deathmatch ? "(ally=" + allyCount + " horde=" + hordeCount + ")" : "(FFA)"));
    }

    spawnAtNode(entity: ServerEntity) {
        var nm = this.nodeManager;
        if (this.cfg.deathmatch && entity.team !== FactionTeam.None) {
            var spawn = nm.getRandomSpawnForTeam(entity.team);
            if (spawn !== null) {
                entity.position = vec3.fromValues(spawn.x, spawn.y, spawn.z);
                entity.currentNodeId = spawn.id;
                return;
            }
        }

        var node = nm.getRandomNode();
        if (node === null) {
            entity.position = vec3.create();
            return;
        }
        entity.position = vec3.fromValues(node.x, node.y, node.z);
        entity.currentNodeId = node.id;
    }

    // ========================= Main Tick =========================

    /* One server tick. dt is in seconds. Returns a WorldSnapshot to send to all clients. */
    tick(dt: number): WorldSnapshot {
        this.serverTime += dt;
        // NOTE: clearCombatEvents is called by the game server BEFORE processing client inputs,
        // not here, so instant-spell events from player input aren't wiped.

        // 1. Tick all entity timers
        for (var ent of this.entities.values())
            ent.tickTimers(dt);

        // 2. Update bot AI for all bots (and players in bot mode)
        for (var ent of Array.from(this.entities.values())) { // snapshot to avoid modification during iteration
            if (ent.isDead) continue;
            var isBot = !ent.isPlayer || ent.isBotMode;
            if (!isBot) continue;

            this.botAI.update(ent, dt, this.entities, (start, end) => this.calculatePath(start, end));
        }

        // 3. Update casts/channels for player (handled in botAI for bots)
        for (var ent of this.entities.values()) {
            if (ent.isPlayer && !ent.isBotMode)
                this.combat.updateCasting(ent, dt, this.entities);
        }

        // 4. Update melee auto-attack for players
        for (var ent of this.entities.values()) {
            if (ent.isPlayer && !ent.isBotMode && ent.isAutoAttacking && !ent.isDead) {
                var target = ent.targetId !== null ? this.entities.get(ent.targetId) : undefined;
                if (target && !target.isDead && ent.distanceTo(target) <= this.cfg.meleeRange) {
                    ent.autoAttackTimer += dt;
                    if (ent.autoAttackTimer >= this.cfg.meleeSwingTime) {
                        ent.autoAttackTimer -= this.cfg.meleeSwingTime;
                        this.combat.resolveMeleeHit(ent, target, false);
                    }
                }
            }
        }

        // 5. Track kills for deathmatch
        for (var death of this.combat.pendingDeaths) {
            var killer = this.entities.get(death.killerId);
            if (killer) {
                if (this.cfg.deathmatch) {
                    if (killer.team === FactionTeam.Alliance) this.allianceKills++;
                    else if (killer.team === FactionTeam.Horde) this.hordeKills++;
                }
            }
        }

        // 6. Resurrection timer
        this.ressTimer -= dt;
        if (this.ressTimer <= 0) {
            this.ressTimer = this.cfg.ressurectionInterval;
            this.resurrectAll();
        }

        // 7. Build snapshot
        return this.buildSnapshot();
    }

    // ========================= Player Actions =========================

    /* Handle player position update from client. */
    updatePlayerPosition(playerId: number, pos: vec3, rotation: number, isMoving: boolean) {
        var player = this.entities.get(playerId);
        if (!player) return;
        if (player.isBotMode) return; // bot mode controls position

        player.position = vec3.clone(pos);
        player.rotation = rotation;

        // Cancel casts on movement
        if (isMoving && (player.isCasting || player.isChanneling)) {
            player.cancelCast();
            player.cancelChannel();
            player.currentAnimation = NetAnimationType.Run;
        } else if (isMoving) {
            player.currentAnimation = NetAnimationType.Run;
        } else if (!player.isCasting && !player.isChanneling) {
            player.currentAnimation = NetAnimationType.Idle;
        }
    }

    /* Handle spell cast request from client. */
    playerCastSpell(playerId: number, spell: NetSpellTypeValue, targetId: number | null, groundTarget: vec3 | null) {
        var player = this.entities.get(playerId);
        if (!player) return;
        if (player.isDead) return;

        var target = targetId !== null ? this.entities.get(targetId) || null : null;

        // Start auto-attacking on offensive spell
        if (target !== null && spell !== NetSpellType.IceBlock && spell !== NetSpellType.FrostNova) {
            player.isAutoAttacking = true;
            player.targetId = targetId;
        }

        this.combat.tryCast(player, spell, target, this.entities, groundTarget);
    }

    /* Handle target change from client. */
    playerChangeTarget(playerId: number, targetId: number | null) {
        var player = this.entities.get(playerId);
        if (!player) return;
        player.targetId = targetId;
    }

    /* Handle auto-attack toggle. */
    playerAutoAttack(playerId: number, start: boolean) {
        var player = this.entities.get(playerId);
        if (!player) return;
        player.isAutoAttacking = start;
        if (start) player.autoAttackTimer = 0;
    }

    /* Cancel player cast. */
    playerCancelCast(playerId: number) {
        var player = this.entities.get(playerId);
        if (!player) return;
        player.cancelCast();
        player.cancelChannel();
    }

    /* Toggle bot mode for a player. */
    toggleBotMode(playerId: number, enable: boolean, preferredClass: NetBotClassValue) {
        var player = this.entities.get(playerId);
        if (!player) return;

        if (enable && !player.isBotMode) {
            // Teleport to closest node first
            var node = this.nodeManager.getClosestNode(player.position[0], player.position[1], player.position[2]);
            if (node !== null)
                player.position = vec3.fromValues(node.x, node.y, node.z);
        }

        player.isBotMode = enable;
        player.botClass = preferredClass;
        console.log("[world] Player " + playerId + " bot mode: " + (enable ? "ON" : "OFF") + " class=" + preferredClass);
    }

    // ========================= Resurrection =========================

    resurrectAll() {
        var dead = Array.from(this.entities.values()).filter((e) => e.isDead);
        if (dead.length === 0) return;

        console.log("[world] Resurrecting " + dead.length + " entities");

        for (var ent of dead) {
            var spawnPos = vec3.clone(ent.position); // fallback
            var nm = this.nodeManager;
            if (this.cfg.deathmatch && ent.team !== FactionTeam.None) {
                var spawn = nm.getRandomSpawnForTeam(ent.team);
                if (spawn === null) spawn = nm.getRandomNode();
                if (spawn !== null) spawnPos = vec3.fromValues(spawn.x, spawn.y, spawn.z);
            } else {
                var node = nm.getRandomNode();
                if (node !== null) spawnPos = vec3.fromValues(node.x, node.y, node.z);
            }

            ent.resurrect(spawnPos);
            this.combat.pendingSounds.push({
                soundType: NetSoundType.Resurrect,
                entityId: ent.id,
                description: "[sound stub] Resurrect chime (not yet implemented)"
            });
        }
    }

    // ========================= Navigation =========================

    /* The path from start to end from the cache; null while the mpq server calculates it (web) */
    calculatePath(start: vec3, end: vec3): vec3[] | null {
        for (var e of this.pathCache) {
            if (vec3.distance(e.start, start) <= PositionTolerance && vec3.distance(e.end, end) <= PositionTolerance)
                return e.points !== null ? e.points.map((p) => vec3.clone(p)) : null;
        }

        var entry: PathEntry = { start: vec3.clone(start), end: vec3.clone(end), points: null };
        this.pathCache.push(entry);
        this.calculatePathRaw(start, end).then(
            (points) => { entry.points = points; },
            () => { entry.points = [vec3.clone(start), vec3.clone(end)]; }); // a failed request: a straight line too
        return null;
    }

    async calculatePathRaw(start: vec3, end: vec3): Promise<vec3[]> {
        var result = await gameplayApi.calculatePath(this.cfg.mapId, start, end);
        // navigation not available: a straight line
        if (result === null || result.path.length < 2)
            return [vec3.clone(start), vec3.clone(end)];
        return result.path.map((p) => vec3.fromValues(p.x, p.y, p.z));
    }

    // ========================= Helpers =========================

    /* Clear per-tick event queues, at the start of each game loop iteration, BEFORE the client inputs. */
    clearCombatEvents() {
        this.combat.clearEvents();
    }

    /* A copy of the pending combat events of the current tick. */
    getPendingEvents(): PendingCombatEvents {
        return {
            damage: this.combat.pendingDamage.slice(),
            visuals: this.combat.pendingVisuals.slice(),
            deaths: this.combat.pendingDeaths.slice(),
            sounds: this.combat.pendingSounds.slice()
        };
    }

    // ========================= Snapshot =========================

    buildSnapshot(): WorldSnapshot {
        var snap: WorldSnapshot = {
            entities: [],
            serverTime: this.serverTime,
            ressTimerRemaining: this.ressTimer,
            ressTimerTotal: this.cfg.ressurectionInterval,
            allianceKills: this.allianceKills,
            hordeKills: this.hordeKills,
            blizzardZones: [],
            debugPaths: []
        };

        for (var ent of this.entities.values())
            snap.entities.push(ent.toNetState());

        // Active blizzard zones
        for (var ent of this.entities.values()) {
            if (ent.isChanneling && ent.channelingSpell === NetSpellType.Blizzard && ent.channelTargetPos !== null) {
                snap.blizzardZones.push({
                    casterId: ent.id,
                    position: [ent.channelTargetPos[0], ent.channelTargetPos[1], ent.channelTargetPos[2]],
                    radius: this.cfg.blizzardRadius,
                    timeRemaining: ent.channelDurationTotal - ent.channelElapsed
                });
            }
        }

        // Debug paths
        if (this.cfg.sendDebugPaths) {
            for (var ent of this.entities.values()) {
                if (ent.currentPath !== null && ent.currentPath.length >= 2) {
                    snap.debugPaths.push({
                        entityId: ent.id,
                        points: ent.currentPath.map((p) => [p[0], p[1], p[2]])
                    });
                }
            }
        }

        return snap;
    }
}

export default ServerWorld;
