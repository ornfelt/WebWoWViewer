import {vec3} from 'gl-matrix'
import WorldPlayer from '../objects/worldObjects/worldPlayer.js'
import WorldUnit from '../objects/worldObjects/worldUnit.js'
import { HIDDEN_POS } from '../objects/spellProjectile.js'
import { localPlayerGuid } from '../manager/worldObjectManager.js'
import { AnimationType } from '../manager/playerAnimationState.js'
import { SpellType } from '../objects/spellDefinitions.js'
import { NetBotClass, NetSpellType, NetAnimationType, NetSpellVisualPhase } from '../localServer/netProtocol.js'
import config from '../../services/config.js'

const SEND_INTERVAL = 0.05; // 20 updates/sec

// Exponential smoothing factors per frame (higher = snappier)
const MOVE_SMOOTH = 0.25;
const ROT_SMOOTH = 0.3;

// Sheep models: original entityId -> sheep objectMap key
const SHEEP_KEY_OFFSET = 200000;

const DAMAGE_DELAY_BUFFER = 0.12; // ensures damage text appears after projectile arrives

function toVec3(v) {
    return vec3.fromValues(v[0], v[1], v[2]);
}

function mapNetAnimToLocal(netAnim) {
    switch (netAnim) {
        case NetAnimationType.Idle: return AnimationType.Idle;
        case NetAnimationType.Run: return AnimationType.Run;
        case NetAnimationType.Walk: return AnimationType.Walk;
        case NetAnimationType.Attack: return AnimationType.Attack;
        case NetAnimationType.Attack2: return AnimationType.Attack2;
        case NetAnimationType.Attack3: return AnimationType.Attack3;
        case NetAnimationType.Attack4: return AnimationType.Attack4;
        case NetAnimationType.Attack5: return AnimationType.Attack5;
        case NetAnimationType.Attack6: return AnimationType.Attack6;
        case NetAnimationType.AttackSpecial: return AnimationType.AttackSpecial;
        case NetAnimationType.SpellCast: return AnimationType.SpellCast;
        case NetAnimationType.SpellCast2: return AnimationType.SpellCast2;
        case NetAnimationType.SpellCast3: return AnimationType.SpellCast3;
        case NetAnimationType.SpellCasted: return AnimationType.SpellCasted;
        case NetAnimationType.Die: return AnimationType.Die;
        case NetAnimationType.GettingHit: return AnimationType.GettingHit;
        case NetAnimationType.Stunned: return AnimationType.Stunned;
        case NetAnimationType.StrafeLeft: return AnimationType.StrafeLeft;
        case NetAnimationType.StrafeRight: return AnimationType.StrafeRight;
        default: return null;
    }
}

function mapNetSpellToLocal(netSpell) {
    switch (netSpell) {
        case NetSpellType.Frostbolt: return SpellType.Frostbolt;
        case NetSpellType.IceLance: return SpellType.IceLance;
        case NetSpellType.Pyroblast: return SpellType.Pyroblast;
        case NetSpellType.IceMissile: return SpellType.IceMissile;
        case NetSpellType.LightningBolt: return SpellType.LightningBolt;
        case NetSpellType.Blizzard: return SpellType.Blizzard;
        case NetSpellType.FrostNova: return SpellType.FrostNova;
        case NetSpellType.IceBlock: return SpellType.IceBlock;
        default: return null;
    }
}

function getSpellColor(spell) {
    switch (spell) {
        case NetSpellType.Frostbolt: return [0.3, 0.6, 1, 1];
        case NetSpellType.IceLance: return [0.4, 0.7, 1, 1];
        case NetSpellType.Pyroblast: return [1, 0.3, 0.1, 1];
        case NetSpellType.IceMissile: return [0.4, 0.7, 1, 1];
        case NetSpellType.LightningBolt: return [0.8, 0.8, 0.2, 1];
        case NetSpellType.Blizzard: return [0.5, 0.5, 1, 1];
        case NetSpellType.Polymorph: return [0.8, 0.4, 0.8, 1];
        default: return [0.5, 0.7, 1, 1];
    }
}

/*
 * Bridges the game server with the scene, as my_web_wow's Multiplayer/MultiplayerManager.cs: creates and
 * updates WorldPlayer objects from the server's snapshots, routes the player's input to the server, and
 * handles damage numbers and spell visuals. Call update() each frame.
 *
 * Web differences: the server is the LocalGameServer in the page (one player, no disconnect, entities are
 * never removed). The player is the player character when there is one (player mode); without it (free
 * roam) the server's player entity is shown in front of the camera instead. Projectiles, damage numbers
 * and positions sent for the player use the player character's real position when there is one.
 */
class MultiplayerManager {
    constructor(scene, net) {
        this.scene = scene;
        this.net = net;
        this.playerId = -1;
        this.deathmatch = false;
        this.knownEntities = new Set();
        this.lastSnapshot = null;
        this.currentTargetId = null;
        this.targetableIds = [];
        this.targetCycleIndex = 0;
        this.isBotMode = false;
        this.botClass = NetBotClass.Caster;
        this.playerState = null;
        this.targetState = null;
        this.playerBotStateText = '';
        this.lastSentPos = vec3.create();
        this.lastSentRotation = 0;
        this.sendTimer = 0;
        this.targetPositions = new Map();
        this.targetRotations = new Map();
        this.smoothedPlayerPos = vec3.create();
        this.smoothedPlayerRot = 0;
        this.playerPosInitialized = false;
        this.sheepKeys = new Map();
        this.polymorphedEntities = new Set();
        this.delayedDamage = [];
        this.wasPlayerCasting = false;
        this.wasPlayerChanneling = false;
    }

    get objectMap() {
        return this.scene.worldObjectManager.objectMap;
    }

    /* the player character (player mode), or null in free roam */
    get localCharacter() {
        var unit = this.objectMap[localPlayerGuid];
        return unit instanceof WorldUnit ? unit : null;
    }

    /* the player's server entity is hidden while the player character stands for it (not in bot mode) */
    get playerEntityHidden() {
        return !this.isBotMode && this.localCharacter !== null;
    }

    /* the objectMap key whose model shows the player */
    get playerKey() {
        return this.playerEntityHidden ? localPlayerGuid : this.playerId;
    }

    /* the objectMap key that shows entity id (the player character for the player) */
    displayKey(id) {
        return id === this.playerId ? this.playerKey : id;
    }

    /* Called once with the server's hello. */
    onConnected(hello) {
        this.playerId = hello.playerId;
        this.deathmatch = hello.deathmatch;
        console.log("[mp] Connected as player " + this.playerId + " on map " + hello.mapId +
            " mode=" + (hello.deathmatch ? "Deathmatch" : "FreeForAll"));
    }

    /* Main update, called each frame. deltaTime in milliseconds. */
    update(deltaTime, camera) {
        if (!this.net.isConnected) return;

        // the local server runs its ticks in the frame loop
        this.net.update(deltaTime);

        var dtSec = deltaTime / 1000;

        // Process latest snapshot
        var snapshot = null;
        for (var s of this.net.snapshotQueue) snapshot = s;
        this.net.snapshotQueue = [];
        if (snapshot !== null) {
            this.lastSnapshot = snapshot;
            this.applySnapshot(snapshot);
        }

        // Process sound stubs
        for (var sound of this.net.soundQueue) this.handleSoundStub(sound);
        this.net.soundQueue = [];

        // Process spell visuals BEFORE damage so projectiles spawn
        // before damage delay timers start counting
        for (var vis of this.net.visualQueue) this.handleVisualEvent(vis);
        this.net.visualQueue = [];

        // Process damage events AFTER visuals
        for (var dmg of this.net.damageQueue) this.handleDamageEvent(dmg);
        this.net.damageQueue = [];
        this.net.deathQueue = [];

        // Tick delayed damage numbers
        this.tickDelayedDamage(dtSec);

        // Smooth entity positions
        this.smoothPositions(dtSec);

        // Send player position
        if (!this.isBotMode)
            this.sendPlayerPosition(deltaTime, camera);

        // the player's entity follows the character / camera
        this.placePlayerEntity();
    }

    // ========================= Snapshot Application =========================

    applySnapshot(snap) {
        var om = this.objectMap;

        // Track which entities are in this snapshot
        var activeIds = new Set();

        for (var ent of snap.entities) {
            activeIds.add(ent.id);

            // Create WorldPlayer if new
            if (!this.knownEntities.has(ent.id)) {
                this.createEntity(ent);
                this.knownEntities.add(ent.id);
            }

            // Update existing entity
            var unit = om[ent.id];
            if (unit instanceof WorldUnit)
                this.updateEntity(unit, ent);

            // Track player and target state for HUD
            if (ent.id === this.playerId) {
                this.playerState = ent;
                this.playerBotStateText = this.isBotMode ? ent.botState : '';

                // Drive local player animation from server cast state
                var animState = this.scene.playerAnimState;
                if (!this.isBotMode && animState) {
                    // Cast started
                    if (ent.isCasting && !this.wasPlayerCasting)
                        animState.onCastStart(AnimationType.SpellCast);

                    // Cast ended (completed or cancelled)
                    if (!ent.isCasting && this.wasPlayerCasting)
                        animState.onCastComplete(AnimationType.SpellCasted);

                    // Channel started
                    if (ent.isChanneling && !this.wasPlayerChanneling)
                        animState.onChannelStart(AnimationType.SpellCast2);

                    // Channel ended
                    if (!ent.isChanneling && this.wasPlayerChanneling)
                        animState.onCastCanceled();

                    this.wasPlayerCasting = ent.isCasting;
                    this.wasPlayerChanneling = ent.isChanneling;
                }

                // Freeze local player animation when ice blocked
                var localUnit = this.localCharacter;
                if (!this.isBotMode && localUnit && localUnit.objectModel && localUnit.objectModel.loaded)
                    localUnit.objectModel.animationManager.paused = ent.isIceBlocked;

                // In bot mode, sync target from server
                if (this.isBotMode && ent.targetId !== this.currentTargetId) {
                    this.currentTargetId = ent.targetId;
                    this.syncLocalTarget();
                }
            }
            if (this.currentTargetId !== null && ent.id === this.currentTargetId)
                this.targetState = ent;
        }

        // Update targetable list
        this.targetableIds = snap.entities
            .filter((e) => e.id !== this.playerId && !e.isDead)
            .map((e) => e.id)
            .sort((a, b) => a - b);

        // Validate current target
        if (this.currentTargetId !== null && !activeIds.has(this.currentTargetId)) {
            this.currentTargetId = null;
            this.targetState = null;
        }

        // Feed debug paths to HUD
        if (config.getDrawPathLines() || config.getDrawPathPoints())
            this.scene.hud.setDebugPaths(snap.debugPaths.map((np) => np.points.map(toVec3)));
    }

    createEntity(ent) {
        var wp = new WorldPlayer(this.scene.sceneApi);
        var displayId = ent.displayId;
        var modelPath = ent.modelPath;

        // If polymorphed at creation time, use sheep model
        if (ent.isPolymorphed && ent.polymorphDisplayId > 0) {
            displayId = ent.polymorphDisplayId;
            modelPath = ent.polymorphModelPath ?? modelPath;
        }

        if (displayId > 0) {
            wp.setDisplayId(displayId);
            wp.setNativeDisplayId(displayId);
        } else if (modelPath) {
            wp.setDisplayId(-1);
            wp.setNativeDisplayId(-1);
            wp.modelPathInput = modelPath;
        }

        wp.setScale(ent.scale);
        // the server's animation state drives the model (updateEntity)
        wp.manualAnimation = true;
        wp.complete();

        wp.myFactionTeam = ent.team;
        wp.healthPoints = ent.health;
        wp.healthPointsTotal = ent.healthMax;
        wp.manaPoints = ent.mana;
        wp.manaPointsTotal = ent.manaMax;

        this.objectMap[ent.id] = wp;

        // Initialize smooth position
        var pos = toVec3(ent.position);
        wp.setPosition(vec3.clone(pos));
        wp.setRotation(ent.rotation);
        this.targetPositions.set(ent.id, pos);
        this.targetRotations.set(ent.id, ent.rotation);

        if (ent.id === this.playerId) {
            vec3.copy(this.smoothedPlayerPos, pos);
            this.smoothedPlayerRot = ent.rotation;
            this.playerPosInitialized = true;
        }
    }

    updateEntity(unit, ent) {
        var isLocalPlayer = ent.id === this.playerId && !this.isBotMode;

        // Set interpolation target (actual smoothing happens in smoothPositions)
        if (!isLocalPlayer) {
            this.targetPositions.set(ent.id, toVec3(ent.position));
            this.targetRotations.set(ent.id, ent.rotation);
        }

        // Health / mana
        unit.healthPoints = ent.health;
        unit.healthPointsTotal = ent.healthMax;
        unit.manaPoints = ent.mana;
        unit.manaPointsTotal = ent.manaMax;
        unit.myFactionTeam = ent.team;

        // Polymorph: toggle between the original model and the sheep model
        this.handlePolymorphState(unit, ent);

        // Animation (not for the player's entity while the player character stands for it)
        var animated = !(isLocalPlayer && this.playerEntityHidden);
        if (animated && unit.objectModel && unit.objectModel.loaded) {
            // Freeze animation in place while ice blocked
            unit.objectModel.animationManager.paused = ent.isIceBlocked;

            if (!ent.isIceBlocked) {
                var animType = mapNetAnimToLocal(ent.animation);
                if (animType !== null)
                    this.scene.setUnitAnimation(unit, animType);
            }
        }
    }

    /* Polymorph: hide the original model and show a sheep; restore when un-polymorphed. */
    handlePolymorphState(unit, ent) {
        var om = this.objectMap;
        var wasPoly = this.polymorphedEntities.has(ent.id);
        var isPoly = ent.isPolymorphed && ent.polymorphDisplayId > 0;

        if (isPoly && !wasPoly) {
            // Transition: normal -> polymorphed
            // Hide original model
            unit.setPosition(vec3.clone(HIDDEN_POS));

            // Create sheep model if not yet created
            var sheepKey = ent.id + SHEEP_KEY_OFFSET;
            if (!om[sheepKey]) {
                var sheep = new WorldPlayer(this.scene.sceneApi);
                sheep.setDisplayId(ent.polymorphDisplayId);
                sheep.setNativeDisplayId(ent.polymorphDisplayId);
                if (ent.polymorphModelPath) {
                    sheep.setDisplayId(-1);
                    sheep.setNativeDisplayId(-1);
                    sheep.modelPathInput = ent.polymorphModelPath;
                }
                sheep.setScale(ent.scale);
                sheep.setRotation(0);
                sheep.setPosition(vec3.clone(HIDDEN_POS));
                sheep.complete();
                om[sheepKey] = sheep;
            }

            this.sheepKeys.set(ent.id, sheepKey);
            this.polymorphedEntities.add(ent.id);
        } else if (!isPoly && wasPoly) {
            // Transition: polymorphed -> normal
            // restore position from interpolation target so it doesn't pop from far away
            var restoredPos = this.targetPositions.get(ent.id);
            if (restoredPos) unit.setPosition(vec3.clone(restoredPos));

            // Hide sheep model
            var oldSheepKey = this.sheepKeys.get(ent.id);
            if (oldSheepKey !== undefined && om[oldSheepKey])
                om[oldSheepKey].setPosition(vec3.clone(HIDDEN_POS));

            this.polymorphedEntities.delete(ent.id);
        }

        // Position the sheep at the entity's position while polymorphed
        var sKey = this.sheepKeys.get(ent.id);
        if (isPoly && sKey !== undefined && om[sKey]) {
            var tpos = this.targetPositions.get(ent.id);
            if (tpos) om[sKey].setPosition(vec3.clone(tpos));
            var trot = this.targetRotations.get(ent.id);
            if (trot !== undefined) om[sKey].setRotation(trot);
        }
    }

    // ========================= Position Smoothing =========================

    /* Exponential smoothing: each frame, move each entity a fraction toward its target position. */
    smoothPositions(dtSec) {
        var posFactor = 1 - Math.pow(1 - MOVE_SMOOTH, dtSec * 60);
        var rotFactor = 1 - Math.pow(1 - ROT_SMOOTH, dtSec * 60);

        var om = this.objectMap;

        for (var id of this.knownEntities) {
            if (id === this.playerId && !this.isBotMode) continue;
            var tgt = this.targetPositions.get(id);
            if (!tgt) continue;
            var trot = this.targetRotations.get(id);

            // If polymorphed, smooth the sheep model - don't touch the original
            var smoothKey = this.polymorphedEntities.has(id) ? this.sheepKeys.get(id) : id;
            var unit = smoothKey !== undefined ? om[smoothKey] : undefined;
            if (!unit) continue;

            var smoothed = vec3.lerp(vec3.create(), unit.getPosition(), tgt, posFactor);
            unit.setPosition(smoothed);

            if (trot !== undefined) {
                var r = unit.f !== undefined ? unit.f : trot;
                unit.setRotation(r + (trot - r) * rotFactor);
            }

            if (id === this.playerId) {
                vec3.copy(this.smoothedPlayerPos, this.polymorphedEntities.has(id) ? tgt : smoothed);
                this.smoothedPlayerRot = trot ?? 0;
            }
        }
    }

    /* web: where the player is, and its facing - the player character, or in front of the camera (as the C# always does) */
    getLocalPlayerPose(camera) {
        var character = this.localCharacter;
        if (character)
            return { pos: vec3.clone(character.getPosition()), rot: character.f };

        var cameraPos = this.scene.mainCamera;
        var yawRad = -camera.ah * (Math.PI / 180);
        var pitchRad = -camera.av * (Math.PI / 180);
        var dist = 20;
        var cosPitch = Math.cos(pitchRad);
        return {
            pos: vec3.fromValues(
                cameraPos[0] + Math.cos(yawRad) * cosPitch * dist,
                cameraPos[1] + Math.sin(yawRad) * cosPitch * dist,
                cameraPos[2] + Math.sin(pitchRad) * dist - 6),
            rot: yawRad
        };
    }

    /* web: the player's own entity, shown in free roam where there is no player character, stays with the camera */
    placePlayerEntity() {
        var unit = this.objectMap[this.playerId];
        if (!unit || this.isBotMode || this.polymorphedEntities.has(this.playerId)) return;
        if (this.playerEntityHidden) {
            unit.setPosition(vec3.clone(HIDDEN_POS));
        } else {
            unit.setPosition(vec3.clone(this.lastSentPos));
            unit.setRotation(this.lastSentRotation);
        }
    }

    // ========================= Player Input =========================

    sendPlayerPosition(deltaTime, camera) {
        this.sendTimer += deltaTime / 1000;
        if (this.sendTimer < SEND_INTERVAL) return;
        this.sendTimer = 0;

        var pose = this.getLocalPlayerPose(camera);
        var isMoving = camera.isMoving;

        if (vec3.distance(pose.pos, this.lastSentPos) > 0.1 ||
            Math.abs(pose.rot - this.lastSentRotation) > 0.01 ||
            isMoving) {
            this.net.sendMovement(pose.pos[0], pose.pos[1], pose.pos[2], pose.rot, isMoving);
            vec3.copy(this.lastSentPos, pose.pos);
            this.lastSentRotation = pose.rot;
        }
    }

    // ========================= Target Cycling =========================

    cycleTarget() {
        if (this.targetableIds.length === 0) {
            this.currentTargetId = null;
            this.targetState = null;
            this.net.sendTargetChange(null);
            this.syncLocalTarget();
            return;
        }

        // If current target is still valid, advance from its index
        if (this.currentTargetId !== null) {
            var curIdx = this.targetableIds.indexOf(this.currentTargetId);
            if (curIdx >= 0)
                this.targetCycleIndex = (curIdx + 1) % this.targetableIds.length;
            else
                this.targetCycleIndex = 0; // current target gone, start from the first
        } else {
            this.targetCycleIndex = 0; // no target, pick the first
        }

        this.currentTargetId = this.targetableIds[this.targetCycleIndex];

        this.net.sendTargetChange(this.currentTargetId);
        this.syncLocalTarget();
        console.log("[mp] Target cycled to " + this.currentTargetId);
    }

    syncLocalTarget() {
        var om = this.objectMap;
        var tgt = this.currentTargetId !== null ? om[this.currentTargetId] : undefined;
        var target = tgt instanceof WorldUnit ? tgt : null;

        // Sync onto the server's player entity and the player character
        for (var key of [this.playerId, localPlayerGuid]) {
            var unit = om[key];
            if (unit instanceof WorldUnit) {
                unit.target = target;
                unit.targetIndex = target !== null ? this.currentTargetId : 0;
            }
        }

        var sm = this.scene.spellManager;
        if (sm) {
            sm.rebuildTargetList();
            if (this.currentTargetId !== null)
                sm.setTargetByKey(this.currentTargetId);
        }
    }

    getCurrentTargetId() {
        return this.currentTargetId;
    }

    // ========================= Spell Casting =========================

    castSpell(spell) {
        if (!this.net.isConnected) return;

        var isSelfArea = spell === NetSpellType.FrostNova || spell === NetSpellType.IceBlock;
        var isChannel = spell === NetSpellType.Blizzard;
        var needsTarget = !isSelfArea;

        if (needsTarget) {
            if (this.currentTargetId === null) return;
            if (this.targetState !== null && this.targetState.isDead) return;

            // Client-side range check (mirrors server validation)
            var dist = this.measureDistance(this.playerId, this.currentTargetId);
            var isMelee = spell === NetSpellType.Kick || spell === NetSpellType.MeleeAttack || spell === NetSpellType.MeleeSpecial;
            var maxRange = isMelee ? 5 : 50;
            if (dist > maxRange) return;
        }

        var groundTarget = null;
        if (spell === NetSpellType.Blizzard && this.currentTargetId !== null) {
            var tgt = this.objectMap[this.currentTargetId];
            if (tgt) groundTarget = vec3.clone(tgt.getPosition());
        }

        this.net.sendSpellCast(spell, this.currentTargetId, groundTarget);

        if (this.currentTargetId !== null && !isSelfArea)
            this.net.sendAutoAttack(true);

        // Local visuals: area effects and channels get instant local feedback
        var localSpellType = mapNetSpellToLocal(spell);
        var sm = this.scene.spellManager;
        if (localSpellType !== null && sm && (isSelfArea || isChannel)) {
            if (this.currentTargetId !== null)
                sm.setTargetByKey(this.currentTargetId);
            if (isSelfArea && !this.localCharacter) {
                // web: no player character to cast from, so at the player's entity
                var own = this.objectMap[this.playerId];
                if (own) sm.fireAreaEffectAt(localSpellType, vec3.clone(own.getPosition()));
            } else {
                sm.castSpell(localSpellType);
            }
        }

        // Instant spell animation (cast-time spells are driven by server state in applySnapshot)
        var animState = this.scene.playerAnimState;
        if (!this.isBotMode && animState && !isSelfArea && !isChannel) {
            var isInstant = spell === NetSpellType.IceLance || spell === NetSpellType.Counterspell
                || spell === NetSpellType.Kick || spell === NetSpellType.MeleeAttack || spell === NetSpellType.MeleeSpecial;
            if (isInstant) {
                animState.onCastStart(AnimationType.SpellCast);
                animState.onCastComplete(AnimationType.SpellCasted);
            }
        }
    }

    // ========================= Bot Mode =========================

    toggleBotMode() {
        this.isBotMode = !this.isBotMode;
        this.net.sendBotModeToggle(this.isBotMode, this.botClass);

        // Bot mode ON: the server controls the player - show its entity, hide the player character
        this.scene.worldObjectManager.hideLocalPlayer = this.isBotMode;

        console.log("[mp] Bot mode: " + (this.isBotMode ? "ON" : "OFF") + " class=" + this.botClass);
    }

    // ========================= Sound Stubs =========================

    handleSoundStub(sound) {
        // the C#'s debug log
        console.debug(sound.description + " (entity " + sound.entityId + ")");
    }

    // ========================= Projectile Travel Time =========================

    /* Current rendered distance between two entity IDs (the player is the player character when there is one); 0 if either is missing. */
    measureDistance(sourceId, targetId) {
        var src = this.objectMap[this.displayKey(sourceId)];
        var tgt = this.objectMap[this.displayKey(targetId)];
        if (!src || !tgt) return 0;
        return vec3.distance(src.getPosition(), tgt.getPosition());
    }

    // ========================= Damage Numbers =========================

    handleDamageEvent(dmg) {
        if (dmg.sourceId !== this.playerId) return;

        var color;
        if (dmg.amount <= 0)
            color = [0.7, 0.7, 0.7];
        else if (dmg.isCrit)
            color = [1, 0.4, 0];
        else
            color = [1, 1, 0.3];

        var displayAmount = Math.max(0, dmg.amount);
        var travelTime = dmg.travelTime;
        var targetKey = this.displayKey(dmg.targetId);

        if (travelTime <= 0.05)
            this.showDamage(displayAmount, targetKey, color, dmg.isCrit);
        else
            this.delayedDamage.push({
                amount: displayAmount,
                targetKey: targetKey,
                color: color,
                crit: dmg.isCrit,
                delay: travelTime + DAMAGE_DELAY_BUFFER
            });
    }

    /* web: over the target (the C# shows it near the screen centre) */
    showDamage(amount, targetKey, color, crit) {
        var unit = this.objectMap[targetKey];
        if (unit instanceof WorldUnit)
            this.scene.hud.addDamageNumberAtUnit(unit, amount, crit, color);
    }

    tickDelayedDamage(dtSec) {
        for (var i = this.delayedDamage.length - 1; i >= 0; i--) {
            var d = this.delayedDamage[i];
            d.delay -= dtSec;
            if (d.delay <= 0) {
                this.showDamage(d.amount, d.targetKey, d.color, d.crit);
                this.delayedDamage.splice(i, 1);
            }
        }
    }

    // ========================= Spell Visual Events (bot effects) =========================

    handleVisualEvent(vis) {
        var localSpell = mapNetSpellToLocal(vis.spellType);
        if (localSpell === null) return;
        var sm = this.scene.spellManager;
        if (!sm) return;

        switch (vis.phase) {
            case NetSpellVisualPhase.ProjectileFire:
                if (vis.targetId !== null) {
                    var casterKey = this.displayKey(vis.casterId);
                    // web: at the player character when the player is the target
                    var targetKey = this.displayKey(vis.targetId);

                    // Derive speed from client distance and server travel time
                    // so the projectile arrives at exactly the moment damage appears
                    var dist = this.measureDistance(vis.casterId, vis.targetId);
                    var speed;
                    if (vis.travelTime > 0 && dist > 0)
                        speed = dist / vis.travelTime;
                    else
                        speed = 40; // fallback

                    sm.fireProjectileFromTo(localSpell, casterKey, targetKey, speed);
                }
                break;

            case NetSpellVisualPhase.AreaEffect:
                if (vis.casterId === this.playerId) return;
                if (vis.targetPosition !== null) {
                    var pos = toVec3(vis.targetPosition);
                    if (vis.spellType === NetSpellType.FrostNova)
                        sm.fireAreaEffectAt(SpellType.FrostNova, pos);
                    else if (vis.spellType === NetSpellType.IceBlock)
                        sm.fireAreaEffectAt(SpellType.IceBlock, pos);
                }
                break;

            // ChannelStart intentionally not handled here:
            // - Player blizzard: fired locally in castSpell for instant feedback + cast bar
            // - Bot blizzard: rendered as ground circles from the snapshot's blizzardZones
        }
    }

    // ========================= HUD State Building =========================

    buildMultiplayerHudState() {
        var hud = this.scene.hud;
        var s = hud.buildHudState();

        if (this.playerState !== null) {
            var ps = this.playerState;
            s.player = {
                hpPct: ps.healthMax > 0 ? ps.health / ps.healthMax : 1,
                manaPct: ps.manaMax > 0 ? ps.mana / ps.manaMax : 1,
                team: ps.team
            };

            // Cast bar: prefer local SpellManager (instant feedback), fall back to server
            s.playerCasting = false;
            var sm = this.scene.spellManager;
            if (sm) {
                var cast = sm.getCastBarState();
                if (cast.active) {
                    s.playerCasting = true;
                    s.playerCastProgress = cast.progress;
                    s.playerCastColor = cast.color;
                } else if (ps.isCasting) {
                    s.playerCasting = true;
                    s.playerCastProgress = ps.castProgress;
                    s.playerCastColor = getSpellColor(ps.castingSpell);
                } else if (ps.isChanneling) {
                    s.playerCasting = true;
                    s.playerCastProgress = ps.channelProgress;
                    s.playerCastColor = [0.5, 0.5, 1, 1];
                }
            }
        }

        s.hasTarget = false;
        if (this.targetState !== null && this.currentTargetId !== null) {
            var ts = this.targetState;
            s.hasTarget = true;
            s.targetIndex = this.currentTargetId;
            s.target = {
                hpPct: ts.healthMax > 0 ? ts.health / ts.healthMax : 1,
                manaPct: ts.manaMax > 0 ? ts.mana / ts.manaMax : 1,
                team: ts.team
            };

            if (ts.isCasting) {
                s.targetCasting = true;
                s.targetCastProgress = ts.castProgress;
                s.targetCastColor = getSpellColor(ts.castingSpell);
            } else if (ts.isChanneling) {
                s.targetCasting = true;
                s.targetCastProgress = ts.channelProgress;
                s.targetCastColor = [0.5, 0.5, 1, 1];
            }
        }

        if (this.lastSnapshot !== null) {
            var snap = this.lastSnapshot;
            s.showRessTimer = true;
            s.ressSecondsLeft = Math.trunc(snap.ressTimerRemaining);
            s.ressSecondsTotal = Math.trunc(snap.ressTimerTotal);
            s.ressFraction = snap.ressTimerTotal > 0 ? snap.ressTimerRemaining / snap.ressTimerTotal : 1;

            if (this.deathmatch) {
                s.deathmatch = true;
                s.allianceKills = snap.allianceKills;
                s.hordeKills = snap.hordeKills;
            }
        }

        return s;
    }

    // ========================= World-space effects =========================

    /* Draw blizzard ground circles from the server snapshot. */
    drawBlizzardCircles() {
        if (this.lastSnapshot === null) return;
        for (var zone of this.lastSnapshot.blizzardZones)
            this.scene.hud.drawBlizzardCircle(toVec3(zone.position), zone.radius);
    }

    /* Draw small blue circles under frozen (frost nova'd) entities. */
    drawFrozenCircles() {
        if (this.lastSnapshot === null) return;
        var om = this.objectMap;

        for (var ent of this.lastSnapshot.entities) {
            if (!ent.isFrozenByNova) continue;
            var unit = om[this.displayKey(ent.id)];
            if (!unit) continue;

            var pos = unit.getPosition();
            // Smaller, lighter blue circle than blizzard
            this.scene.hud.dd.disc3D(pos, 1.2, [0.3, 0.5, 1, 0.4], 24, 0.3);
            this.scene.hud.dd.circle3D(pos, 1.2, [0.4, 0.6, 1, 0.7], 24, 0.3);
        }
    }

    /* The SMOOTHED player position for the bot-mode camera, or null before the first snapshot. */
    getPlayerPositionFromServer() {
        if (!this.playerPosInitialized || this.playerState === null) return null;
        return this.smoothedPlayerPos;
    }

    /* The smoothed player rotation for the bot-mode camera. */
    getPlayerRotationFromServer() {
        return this.smoothedPlayerRot;
    }
}

export default MultiplayerManager;
