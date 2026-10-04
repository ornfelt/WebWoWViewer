import {vec3} from 'gl-matrix'
import { FactionTeam } from '../manager/nodeManager'
import { NetBotClass, NetAnimationType, NetBotState } from './netProtocol'
import { PolymorphDisplayId, PolymorphModelPath } from './serverConfig'
import type ServerConfig from './serverConfig';
import type { FactionTeamValue } from '../manager/nodeManager';
import type { NetBotClassValue, NetSpellTypeValue, NetSpellSchoolValue, NetAnimationTypeValue, NetBotStateValue, NetEntityState } from './netProtocol';

var nextId = 100;

/*
 * A server-side entity (player or bot) with all combat, movement, and status state, as my_web_wow's
 * WowServer/ServerEntity.cs. Times are in seconds.
 */
class ServerEntity {
    id: number;
    displayId: number;
    modelPath: string;
    scale: number;
    position: vec3;
    rotation: number;
    isPlayer: boolean;
    isBotMode: boolean;     // player toggled bot mode
    botClass: NetBotClassValue;
    team: FactionTeamValue;

    // Health / Mana
    health: number;
    healthMax: number;
    mana: number;
    manaMax: number;

    // Combat state
    targetId: number | null;
    isAutoAttacking: boolean;
    autoAttackTimer: number;       // counts up to swing time
    specialAttackTimer: number;    // counts down to 0 when special is landing

    // Casting state
    isCasting: boolean;
    castingSpell: NetSpellTypeValue | null;
    castTimeTotal: number;
    castTimeElapsed: number;
    castTargetId: number | null;

    // Channeling state
    isChanneling: boolean;
    channelingSpell: NetSpellTypeValue | null;
    channelDurationTotal: number;
    channelElapsed: number;
    channelTargetPos: vec3 | null;
    channelTickTimer: number;      // blizzard damage tick

    // Status effects
    isPolymorphed: boolean;
    polymorphTimer: number;
    isFrozenByNova: boolean;
    frostNovaTimer: number;
    isIceBlocked: boolean;
    iceBlockTimer: number;

    // Cooldowns: spell type -> remaining seconds
    cooldowns: Map<NetSpellTypeValue, number>;

    // School lockouts: school -> remaining seconds
    schoolLockouts: Map<NetSpellSchoolValue, number>;

    // Animation
    currentAnimation: NetAnimationTypeValue;

    // Bot AI state
    botState: NetBotStateValue;

    // Wandering
    currentPath: vec3[] | null;
    pathIndex: number;
    wanderWaitTimer: number;
    currentNodeId: number | null;
    previousNodeId: number | null;
    smoothedDirection: vec3;
    // web: the node whose path is being calculated (the navigation api is asynchronous)
    pendingWanderNodeId: number | null;

    // Bot targeting
    retargetTimer: number;
    castDecisionTimer: number;
    giveUpAccumulator: number;   // increases as target gets further

    // Stats tracking
    killCount: number;

    // Original model info (for restoring after polymorph)
    originalDisplayId: number;
    originalModelPath: string;

    constructor(isPlayer = false) {
        this.id = nextId++;
        this.isPlayer = isPlayer;

        this.displayId = 0;
        this.modelPath = '';
        this.scale = 1;
        this.position = vec3.create();
        this.rotation = 0;
        this.isBotMode = false;
        this.botClass = NetBotClass.Melee;
        this.team = FactionTeam.None;

        this.health = 0;
        this.healthMax = 0;
        this.mana = 0;
        this.manaMax = 0;

        this.targetId = null;
        this.isAutoAttacking = false;
        this.autoAttackTimer = 0;
        this.specialAttackTimer = 0;

        this.isCasting = false;
        this.castingSpell = null;
        this.castTimeTotal = 0;
        this.castTimeElapsed = 0;
        this.castTargetId = null;

        this.isChanneling = false;
        this.channelingSpell = null;
        this.channelDurationTotal = 0;
        this.channelElapsed = 0;
        this.channelTargetPos = null;
        this.channelTickTimer = 0;

        this.isPolymorphed = false;
        this.polymorphTimer = 0;
        this.isFrozenByNova = false;
        this.frostNovaTimer = 0;
        this.isIceBlocked = false;
        this.iceBlockTimer = 0;

        this.cooldowns = new Map();
        this.schoolLockouts = new Map();

        this.currentAnimation = NetAnimationType.Idle;
        this.botState = NetBotState.Idle;

        this.currentPath = null;
        this.pathIndex = 0;
        this.wanderWaitTimer = 0;
        this.currentNodeId = null;
        this.previousNodeId = null;
        this.smoothedDirection = vec3.create();
        this.pendingWanderNodeId = null;

        this.retargetTimer = 0;
        this.castDecisionTimer = 0;
        this.giveUpAccumulator = 0;

        this.killCount = 0;

        this.originalDisplayId = 0;
        this.originalModelPath = '';
    }

    /* Reset ID counter (call before spawning a new game). */
    static resetIdCounter() {
        nextId = 100;
    }

    get isDead(): boolean {
        return this.health <= 0;
    }

    get castProgress(): number {
        return this.castTimeTotal > 0 ? Math.min(Math.max(this.castTimeElapsed / this.castTimeTotal, 0), 1) : 1;
    }

    get channelProgress(): number {
        return this.channelDurationTotal > 0
            ? Math.min(Math.max(1 - this.channelElapsed / this.channelDurationTotal, 0), 1) : 0;
    }

    initHealth(cfg: ServerConfig) {
        this.healthMax = cfg.baseHealth;
        this.health = this.healthMax;
        this.manaMax = cfg.baseMana;
        this.mana = this.manaMax;
    }

    saveOriginalModel() {
        this.originalDisplayId = this.displayId;
        this.originalModelPath = this.modelPath;
    }

    restoreOriginalModel() {
        this.displayId = this.originalDisplayId;
        this.modelPath = this.originalModelPath;
    }

    get isIncapacitated(): boolean {
        return this.isPolymorphed || this.isFrozenByNova || this.isIceBlocked || this.isDead;
    }
    get canAct(): boolean {
        return !this.isIncapacitated;
    }
    get canMove(): boolean {
        return !this.isFrozenByNova && !this.isIceBlocked && !this.isPolymorphed && !this.isDead;
    }
    get canCast(): boolean {
        return this.canAct && !this.isCasting && !this.isChanneling;
    }

    isOnCooldown(spell: NetSpellTypeValue): boolean {
        var cd = this.cooldowns.get(spell);
        return cd !== undefined && cd > 0;
    }

    isSchoolLocked(school: NetSpellSchoolValue): boolean {
        var cd = this.schoolLockouts.get(school);
        return cd !== undefined && cd > 0;
    }

    setCooldown(spell: NetSpellTypeValue, seconds: number) {
        this.cooldowns.set(spell, seconds);
    }

    lockSchool(school: NetSpellSchoolValue, seconds: number) {
        this.schoolLockouts.set(school, seconds);
    }

    distanceTo(other: ServerEntity | vec3): number {
        return vec3.distance(this.position, other instanceof ServerEntity ? other.position : other);
    }

    lookAt(target: vec3) {
        var dx = target[0] - this.position[0], dy = target[1] - this.position[1], dz = target[2] - this.position[2];
        if (dx * dx + dy * dy + dz * dz > 0.001)
            this.rotation = Math.atan2(dy, dx);
    }

    /* Apply damage. Returns actual damage dealt (clamped to remaining HP). */
    takeDamage(amount: number): number {
        if (this.isDead || this.isIceBlocked) return 0;

        // Polymorph breaks on damage
        if (this.isPolymorphed) {
            this.isPolymorphed = false;
            this.polymorphTimer = 0;
            this.restoreOriginalModel();
        }

        var actual = Math.min(this.health, amount);
        this.health -= actual;
        return actual;
    }

    /* Kill this entity. */
    die() {
        this.health = 0;
        this.botState = NetBotState.Dead;
        this.currentAnimation = NetAnimationType.Die;
        this.cancelAllEffects();
    }

    /* Resurrect with full health at the given position. */
    resurrect(spawnPos: vec3) {
        this.health = this.healthMax;
        this.mana = this.manaMax;
        this.position = vec3.clone(spawnPos);
        this.botState = NetBotState.Idle;
        this.currentAnimation = NetAnimationType.Idle;
        this.cancelAllEffects();
        this.restoreOriginalModel();
        this.currentPath = null;
        this.pathIndex = 0;
        this.targetId = null;
        this.isAutoAttacking = false;
    }

    cancelCast() {
        this.isCasting = false;
        this.castingSpell = null;
        this.castTimeElapsed = 0;
        this.castTimeTotal = 0;
        this.castTargetId = null;
    }

    cancelChannel() {
        this.isChanneling = false;
        this.channelingSpell = null;
        this.channelElapsed = 0;
        this.channelDurationTotal = 0;
        this.channelTargetPos = null;
        this.channelTickTimer = 0;
    }

    cancelAllEffects() {
        this.cancelCast();
        this.cancelChannel();
        this.isPolymorphed = false;
        this.polymorphTimer = 0;
        this.isFrozenByNova = false;
        this.frostNovaTimer = 0;
        this.isIceBlocked = false;
        this.iceBlockTimer = 0;
    }

    /* Tick all timers down by dt seconds. */
    tickTimers(dt: number) {
        // Cooldowns
        for (var [spell, cd] of Array.from(this.cooldowns)) {
            if (cd - dt <= 0) this.cooldowns.delete(spell);
            else this.cooldowns.set(spell, cd - dt);
        }

        // School lockouts
        for (var [school, lock] of Array.from(this.schoolLockouts)) {
            if (lock - dt <= 0) this.schoolLockouts.delete(school);
            else this.schoolLockouts.set(school, lock - dt);
        }

        // Polymorph
        if (this.isPolymorphed) {
            this.polymorphTimer -= dt;
            if (this.polymorphTimer <= 0) {
                this.isPolymorphed = false;
                this.restoreOriginalModel();
            }
        }

        // Frost nova
        if (this.isFrozenByNova) {
            this.frostNovaTimer -= dt;
            if (this.frostNovaTimer <= 0)
                this.isFrozenByNova = false;
        }

        // Ice block
        if (this.isIceBlocked) {
            this.iceBlockTimer -= dt;
            if (this.iceBlockTimer <= 0) {
                this.isIceBlocked = false;
                this.restoreOriginalModel();
            }
        }
    }

    /* The entity state for the clients. */
    toNetState(): NetEntityState {
        return {
            id: this.id,
            displayId: this.displayId,
            modelPath: this.modelPath,
            scale: this.scale,
            position: [this.position[0], this.position[1], this.position[2]],
            rotation: this.rotation,
            health: this.health,
            healthMax: this.healthMax,
            mana: this.mana,
            manaMax: this.manaMax,
            team: this.team,
            isDead: this.isDead,
            isPlayer: this.isPlayer,
            botClass: this.botClass,
            animation: this.currentAnimation,
            isCasting: this.isCasting,
            castProgress: this.castProgress,
            castingSpell: this.castingSpell,
            isChanneling: this.isChanneling,
            channelProgress: this.channelProgress,
            isPolymorphed: this.isPolymorphed,
            isFrozenByNova: this.isFrozenByNova,
            isIceBlocked: this.isIceBlocked,
            isAutoAttacking: this.isAutoAttacking,
            targetId: this.targetId,
            botState: this.botState,
            polymorphModelPath: this.isPolymorphed ? PolymorphModelPath : null,
            polymorphDisplayId: this.isPolymorphed ? PolymorphDisplayId : 0
        };
    }
}

export default ServerEntity;
