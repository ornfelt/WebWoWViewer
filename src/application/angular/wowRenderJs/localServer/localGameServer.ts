import {vec3} from 'gl-matrix'
import ServerConfig from './serverConfig'
import ServerWorld from './serverWorld'
import type NodeManager from '../manager/nodeManager';
import type { NetSpellTypeValue, NetBotClassValue, ServerHello, WorldSnapshot, NetDamageEvent, NetSpellVisualEvent, NetEntityDied, NetSoundStub } from './netProtocol';

/*
 * The game server and its connection in one, in the page: my_web_wow's WowServer/GameServer.cs (the game
 * loop: inputs, tick, snapshot and events at tickRate) and the client side of my_web_wow's
 * Multiplayer/NetworkClient.cs (the send* methods and the receive queues MultiplayerManager reads). The C#
 * runs the server as its own process and talks over TCP; a browser cannot, so the web version runs the
 * same game logic locally, for one player against the bots.
 */
class LocalGameServer {
    cfg: ServerConfig;
    world: ServerWorld;
    hello: ServerHello;

    // the client's messages, applied at the start of the next tick (GameServer.InboundQueue)
    inbound: (() => void)[];

    // what the client receives (NetworkClient's queues)
    snapshotQueue: WorldSnapshot[];
    damageQueue: NetDamageEvent[];
    visualQueue: NetSpellVisualEvent[];
    deathQueue: NetEntityDied[];
    soundQueue: NetSoundStub[];

    // milliseconds since the last tick
    sinceLastTick: number;

    constructor(mapId: number, expansion: string, deathmatch: boolean, botCount: number, devMode: boolean, nodeManager: NodeManager) {
        this.cfg = new ServerConfig(mapId, expansion, deathmatch, botCount, devMode);
        this.world = new ServerWorld(this.cfg, nodeManager);
        this.world.initialize();

        // the connecting client's player, then the bots (GameServer accepts the client after spawning them)
        this.world.spawnBots();
        var player = this.world.createPlayer();

        this.hello = {
            playerId: player.id,
            mapId: mapId,
            expansion: expansion,
            deathmatch: deathmatch,
            botCount: botCount,
            tickRate: this.cfg.tickRate,
            devMode: devMode
        };

        this.inbound = [];
        this.snapshotQueue = [];
        this.damageQueue = [];
        this.visualQueue = [];
        this.deathQueue = [];
        this.soundQueue = [];
        this.sinceLastTick = 0;
    }

    get isConnected(): boolean {
        return true;
    }

    /* the game loop: one tick when 1 / tickRate has passed, with the time since the last one as dt. deltaTime is in milliseconds. */
    update(deltaTime: number) {
        this.sinceLastTick += deltaTime;
        var tickInterval = 1000 / this.cfg.tickRate;
        if (this.sinceLastTick < tickInterval) return;

        var dt = this.sinceLastTick / 1000;
        this.sinceLastTick = 0;

        // Clear events BEFORE input processing, so instant-spell
        // events produced by the inputs survive to the broadcast
        this.world.clearCombatEvents();

        // Process all client inputs
        var inputs = this.inbound;
        this.inbound = [];
        for (var input of inputs) {
            try {
                input();
            } catch (e) {
                console.log("[server] Error processing input: " + (e as Error).message);
            }
        }

        // Tick the world, broadcast the snapshot and the events
        try {
            this.snapshotQueue.push(this.world.tick(dt));

            var events = this.world.getPendingEvents();
            this.damageQueue.push(...events.damage);
            this.visualQueue.push(...events.visuals);
            this.deathQueue.push(...events.deaths);
            this.soundQueue.push(...events.sounds);
        } catch (e) {
            console.log("[server] Tick error: " + (e as Error).message);
        }
    }

    // ========================= Client -> Server =========================

    sendMovement(x: number, y: number, z: number, rotation: number, isMoving: boolean) {
        var playerId = this.hello.playerId;
        this.inbound.push(() => this.world.updatePlayerPosition(playerId, vec3.fromValues(x, y, z), rotation, isMoving));
    }

    sendSpellCast(spell: NetSpellTypeValue, targetId: number | null, groundTarget: vec3 | null) {
        var playerId = this.hello.playerId;
        this.inbound.push(() => this.world.playerCastSpell(playerId, spell, targetId, groundTarget));
    }

    sendTargetChange(targetId: number | null) {
        var playerId = this.hello.playerId;
        this.inbound.push(() => this.world.playerChangeTarget(playerId, targetId));
    }

    sendAutoAttack(start: boolean) {
        var playerId = this.hello.playerId;
        this.inbound.push(() => this.world.playerAutoAttack(playerId, start));
    }

    sendBotModeToggle(enable: boolean, preferredClass: NetBotClassValue) {
        var playerId = this.hello.playerId;
        this.inbound.push(() => this.world.toggleBotMode(playerId, enable, preferredClass));
    }

    sendCancelCast() {
        var playerId = this.hello.playerId;
        this.inbound.push(() => this.world.playerCancelCast(playerId));
    }

    /* the dev mode can be switched during the game (the C# reads it from its config on every target search) */
    setDevMode(devMode: boolean) {
        this.cfg.devMode = devMode;
    }
}

export default LocalGameServer;
