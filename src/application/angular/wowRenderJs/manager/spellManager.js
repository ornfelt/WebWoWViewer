import {vec3} from 'gl-matrix'
import WorldUnit from '../objects/worldObjects/worldUnit.js'
import SpellProjectilePool from '../objects/spellProjectilePool.js'
import AreaEffect from '../objects/areaEffect.js'
import ChanneledSpell from '../objects/channeledSpell.js'
import CastingState from '../objects/castingState.js'
import { SpellType, SpellCategory, getSpellDefinition, CritChance, CritMultiplier, BlizzardRadius, BlizzardTickInterval } from '../objects/spellDefinitions.js'

// ---- Object-map key reservations ----
// Projectile pools:  99990000 + (spellIndex * poolSize) .. +poolSize-1
// Area effects:       99991000 + offset
// Channeled:          99992000 + offset
const ProjectileKeyBase = 99990000;
const AreaKeyBase       = 99991000;
const ChannelKeyBase    = 99992000;

const PoolSize = 5; // max simultaneous projectiles per spell type

/*
 * Manages all spells: projectile pools, area effects, channeled spells, casting state, and the target
 * cycling system, as my_web_wow's SpellManager.cs. Each projectile spell type has a pool of PoolSize, so
 * multiple copies can be in flight at once.
 *
 * Web addition: the damage on hit. The C# only shows damage in multiplayer (from the server); here a
 * landed projectile and every Blizzard tick roll the server's damage ranges locally, lower the target's
 * health (a unit at 0 is reset to full) and report it through onDamage, for the floating combat text.
 */
class SpellManager {
    constructor(sceneApi, worldObjectManager, playerKey) {
        this.sceneApi = sceneApi;
        this.worldObjectManager = worldObjectManager;
        this.playerKey = playerKey;

        this.targetKeys = [];
        this.currentTargetIndex = 0;
        this.projectilePools = new Map();
        this.activeCast = null;
        this.onAnimationStart = null;
        this.onAnimationComplete = null;
        this.onCastCanceled = null;
        this.onDamage = null;
        this.localDamage = true;
        this.activeChannelType = null;
        this.blizzardTargetPos = null;
        this.blizzardTickTimer = 0;

        this.initProjectilePools();
        this.initAreaEffects();
        this.initChanneledSpells();

        this.rebuildTargetList();
    }

    get isChanneling() {
        return this.blizzardChannel.isActive;
    }
    get isCasting() {
        return this.activeCast !== null && !this.activeCast.isComplete;
    }
    get isBusy() {
        return this.isCasting || this.isChanneling;
    }

    /* The world-space position where Blizzard is being channeled, or null if not active (ground level, for the circle indicator) */
    get blizzardTargetPosition() {
        return this.blizzardChannel.isActive ? this.blizzardTargetPos : null;
    }

    initProjectilePools() {
        var projectileTypes = [
            SpellType.Frostbolt, SpellType.IceLance, SpellType.Pyroblast,
            SpellType.IceMissile, SpellType.LightningBolt
        ];

        for (var spellIdx = 0; spellIdx < projectileTypes.length; spellIdx++) {
            var type = projectileTypes[spellIdx];
            var def = getSpellDefinition(type);
            if (def === null) continue;

            var baseKey = ProjectileKeyBase + (spellIdx * PoolSize);
            var pool = new SpellProjectilePool(
                this.sceneApi, this.worldObjectManager, def.modelPath, baseKey, PoolSize,
                def.speed, def.arrivalThreshold, def.baseRotationCorrection);
            var damage = def.damage;
            pool.setOnArrive((targetKey) => {
                if (damage !== null && this.localDamage) this.dealDamage(targetKey, damage);
            });

            this.projectilePools.set(type, pool);
        }
    }

    initAreaEffects() {
        // Frost Nova: multi-phase (area model 1s, then state model 5s)
        var frostNovaDef = getSpellDefinition(SpellType.FrostNova);
        this.frostNovaEffect = new AreaEffect(this.sceneApi, this.worldObjectManager, frostNovaDef.phases, AreaKeyBase);

        // Ice Block: single model, 7s
        var iceBlockDef = getSpellDefinition(SpellType.IceBlock);
        this.iceBlockEffect = new AreaEffect(this.sceneApi, this.worldObjectManager, iceBlockDef.modelPath, AreaKeyBase + 10, iceBlockDef.areaDuration);
    }

    initChanneledSpells() {
        var blizzDef = getSpellDefinition(SpellType.Blizzard);
        this.blizzardChannel = new ChanneledSpell(this.sceneApi, this.worldObjectManager, blizzDef.modelPath, ChannelKeyBase, blizzDef.channelDuration);
    }

    // ========================= Target cycling =========================

    isReservedKey(key) {
        // Reserve generous ranges for projectiles, area effects, channeled
        return (key >= ProjectileKeyBase && key < ProjectileKeyBase + 50)
            || (key >= AreaKeyBase && key < AreaKeyBase + 50)
            || (key >= ChannelKeyBase && key < ChannelKeyBase + 50)
            || key === this.playerKey;
    }

    rebuildTargetList() {
        this.targetKeys = Object.keys(this.worldObjectManager.objectMap)
            .map(Number)
            .filter((k) => !this.isReservedKey(k))
            .sort((a, b) => a - b);

        if (this.targetKeys.length > 0 && this.currentTargetIndex >= this.targetKeys.length)
            this.currentTargetIndex = 0;
    }

    cycleTarget() {
        this.rebuildTargetList();
        if (this.targetKeys.length === 0) { this.syncPlayerTargetField(); return; }
        this.currentTargetIndex = (this.currentTargetIndex + 1) % this.targetKeys.length;
        this.syncPlayerTargetField();
        console.log("[SpellManager] Target cycled -> idx " + this.getCurrentTargetIndex() + " key " + this.targetKeys[this.currentTargetIndex]);
    }

    getCurrentTargetKey() {
        if (this.targetKeys.length === 0) return null;
        return this.targetKeys[this.currentTargetIndex];
    }

    getCurrentTargetIndex() {
        return this.targetKeys.length === 0 ? 0 : this.currentTargetIndex + 1;
    }

    getCurrentTarget() {
        var key = this.getCurrentTargetKey();
        if (key === null) return null;
        var unit = this.worldObjectManager.objectMap[key];
        return unit instanceof WorldUnit ? unit : null;
    }

    syncPlayerTargetField() {
        var pl = this.worldObjectManager.objectMap[this.playerKey];
        if (!(pl instanceof WorldUnit)) return;
        pl.target = this.getCurrentTarget();
        pl.targetIndex = this.getCurrentTargetIndex();
    }

    // ========================= Main spell cast entry point =========================

    /* Attempt to cast a spell. Handles cast times, instants, channeled, and area effects. */
    castSpell(type) {
        // Area effects at player (frost nova, ice block) are always allowed, even mid-cast
        var def = getSpellDefinition(type);
        if (def === null) return;

        if (def.category === SpellCategory.AreaAtPlayer) {
            this.fireAreaAtPlayer(type);
            return;
        }

        // Everything else requires not already busy
        if (this.isBusy) return;

        // Target-based spells need a target
        var targetKey = this.getCurrentTargetKey();
        if (targetKey === null) {
            console.log("[SpellManager] No target available for " + type);
            return;
        }

        // Channeled spell (blizzard)
        if (def.isChanneled) {
            this.startChanneling(type, targetKey);
            return;
        }

        // Instant cast projectile (ice lance)
        if (def.castTime <= 0) {
            this.fireProjectile(type, targetKey);
            if (this.onAnimationStart) this.onAnimationStart(def.castAnimation);
            if (def.castCompleteAnimation !== null && this.onAnimationComplete)
                this.onAnimationComplete(def.castCompleteAnimation);
            return;
        }

        // Cast-time projectile (frostbolt, pyroblast, ice missile, lightning bolt)
        this.startCasting(type, targetKey);
    }

    // ========================= Casting (non-instant, non-channeled) =========================

    startCasting(type, targetKey) {
        var def = getSpellDefinition(type);

        if (this.onAnimationStart) this.onAnimationStart(def.castAnimation);

        this.activeCast = new CastingState(type, def.castTime, () => {
            this.fireProjectile(type, targetKey);
            console.log("[SpellManager] " + type + " cast complete, projectile fired!");

            if (def.castCompleteAnimation !== null && this.onAnimationComplete)
                this.onAnimationComplete(def.castCompleteAnimation);
        });

        console.log("[SpellManager] Casting " + type + " (" + def.castTime + "s)...");
    }

    /* Cancel the current cast or channel (e.g. because the player started moving). */
    cancelCast() {
        if (this.activeCast !== null) {
            console.log("[SpellManager] Cast canceled: " + this.activeCast.spellType);
            this.activeCast = null;
            if (this.onCastCanceled) this.onCastCanceled();
        }

        if (this.blizzardChannel.isActive) {
            console.log("[SpellManager] Blizzard channel canceled");
            this.blizzardChannel.cancel();
            this.activeChannelType = null;
            this.blizzardTargetPos = null;
            if (this.onCastCanceled) this.onCastCanceled();
        }
    }

    // ========================= Projectile firing (pooled) =========================

    fireProjectile(type, targetKey) {
        var pool = this.projectilePools.get(type);
        if (!pool) return;

        if (pool.allActive) {
            console.log("[SpellManager] All " + PoolSize + " " + type + " projectiles in flight, wait for one to land");
            return;
        }

        var origin = this.getPlayerPosition();
        pool.fire(origin, targetKey);
        console.log("[SpellManager] " + type + " projectile fired! (" + pool.activeCount + "/" + PoolSize + " in flight)");
    }

    // ========================= Area effects =========================

    fireAreaAtPlayer(type) {
        var playerPos = this.getPlayerPosition();

        switch (type) {
            case SpellType.FrostNova:
                this.frostNovaEffect.activate(playerPos);
                console.log("[SpellManager] Frost Nova activated!");
                break;

            case SpellType.IceBlock:
                this.iceBlockEffect.activate(playerPos);
                console.log("[SpellManager] Ice Block activated!");
                break;
        }
    }

    // ========================= Channeling (blizzard) =========================

    startChanneling(type, targetKey) {
        if (type !== SpellType.Blizzard) return;

        var targetPos = vec3.create();
        var targetUnit = this.worldObjectManager.objectMap[targetKey];
        if (targetUnit)
            vec3.copy(targetPos, targetUnit.getPosition());

        var def = getSpellDefinition(type);

        if (this.onAnimationStart) this.onAnimationStart(def.castAnimation);

        // Store position WITHOUT BODY_AIM_LIFT for the ground circle
        this.blizzardTargetPos = targetPos;
        this.blizzardTickTimer = 0;

        this.blizzardChannel.start(targetPos);
        this.activeChannelType = type;
        console.log("[SpellManager] Blizzard channeling started!");
    }

    // ========================= Damage (web addition) =========================

    /* rolls [min, max] with the server's crit chance, lowers the unit's health (0 -> back to full) and reports it */
    dealDamage(targetKey, range) {
        var unit = this.worldObjectManager.objectMap[targetKey];
        if (!(unit instanceof WorldUnit)) return;

        var amount = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
        var crit = Math.random() < CritChance;
        if (crit) amount = Math.round(amount * CritMultiplier);

        unit.healthPoints -= amount;
        if (unit.healthPoints <= 0)
            unit.healthPoints = unit.healthPointsTotal;

        if (this.onDamage) this.onDamage(unit, amount, crit);
    }

    /* one Blizzard tick: every targetable unit within BlizzardRadius of the channel position */
    blizzardTick() {
        var center = this.blizzardTargetPos;
        var damage = getSpellDefinition(SpellType.Blizzard).damage;
        if (center === null || damage === null) return;

        for (var key of Object.keys(this.worldObjectManager.objectMap).map(Number)) {
            if (this.isReservedKey(key)) continue;
            var unit = this.worldObjectManager.objectMap[key];
            if (unit instanceof WorldUnit && vec3.distance(unit.getPosition(), center) <= BlizzardRadius)
                this.dealDamage(key, damage);
        }
    }

    // ========================= Update =========================

    update(deltaTime) {
        // Update casting
        if (this.activeCast !== null) {
            var justCompleted = this.activeCast.update(deltaTime);
            if (justCompleted || this.activeCast.isComplete)
                this.activeCast = null;
        }

        // Update all projectile pools
        for (var pool of this.projectilePools.values())
            pool.update(deltaTime);

        // Update area effects
        this.frostNovaEffect.update(deltaTime);
        this.iceBlockEffect.update(deltaTime);

        // Blizzard damage ticks (web addition)
        if (this.blizzardChannel.isActive && this.localDamage) {
            this.blizzardTickTimer += deltaTime / 1000;
            while (this.blizzardTickTimer >= BlizzardTickInterval) {
                this.blizzardTickTimer -= BlizzardTickInterval;
                this.blizzardTick();
            }
        }

        // Update channeled spells
        this.blizzardChannel.update(deltaTime);
        if (this.activeChannelType !== null && !this.blizzardChannel.isActive) {
            this.activeChannelType = null;
            this.blizzardTargetPos = null;
            if (this.onCastCanceled) this.onCastCanceled(); // resume idle animation
        }
    }

    // ========================= HUD / cast bar queries =========================

    /* cast bar info for the HUD */
    getCastBarState() {
        // Regular casting
        if (this.activeCast !== null && !this.activeCast.isComplete) {
            var color;
            switch (this.activeCast.spellType) {
                case SpellType.Frostbolt: color = [0.3, 0.6, 1, 1]; break;
                case SpellType.Pyroblast: color = [1, 0.3, 0.1, 1]; break;
                case SpellType.IceMissile: color = [0.4, 0.7, 1, 1]; break;
                case SpellType.LightningBolt: color = [0.8, 0.8, 0.2, 1]; break;
                default: color = [0.5, 0.7, 1, 1]; break;
            }
            return { active: true, progress: this.activeCast.progress, color: color };
        }

        // Channeling (progress drains from 1 to 0)
        if (this.blizzardChannel.isActive) {
            return { active: true, progress: 1 - this.blizzardChannel.progress, color: [0.5, 0.5, 1, 1] };
        }

        return { active: false, progress: 0, color: [0, 0, 0, 0] };
    }

    // ========================= Helpers =========================

    getPlayerPosition() {
        var player = this.worldObjectManager.objectMap[this.playerKey];
        if (player)
            return vec3.clone(player.getPosition());
        return vec3.create();
    }

    /* Fire a projectile visual from one entity to another (for the game server's spell effects); speedOverride adapts the speed so it lands at the server's travel time. */
    fireProjectileFromTo(type, casterKey, targetKey, speedOverride = 0) {
        var pool = this.projectilePools.get(type);
        if (!pool) return;
        if (pool.allActive) return;

        // Get caster position from objectMap
        var origin = vec3.create();
        var caster = this.worldObjectManager.objectMap[casterKey];
        if (caster)
            vec3.copy(origin, caster.getPosition());

        if (speedOverride > 0)
            pool.fireWithSpeed(origin, targetKey, speedOverride);
        else
            pool.fire(origin, targetKey);
    }

    /* Fire an area effect (frost nova / ice block) at an arbitrary world position. */
    fireAreaEffectAt(type, position) {
        switch (type) {
            case SpellType.FrostNova:
                this.frostNovaEffect.activate(position);
                break;
            case SpellType.IceBlock:
                this.iceBlockEffect.activate(position);
                break;
        }
    }

    /* Start a channeled spell visual at a position (for the game server's blizzard effects). */
    startChannelAt(type, position) {
        if (type === SpellType.Blizzard)
            this.blizzardChannel.start(position);
    }

    /* Set the internal target to a specific objectMap key */
    setTargetByKey(key) {
        this.rebuildTargetList();
        var idx = this.targetKeys.indexOf(key);
        if (idx >= 0) {
            this.currentTargetIndex = idx;
            this.syncPlayerTargetField();
        }
    }
}

export default SpellManager;
