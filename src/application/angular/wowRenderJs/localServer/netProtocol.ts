import type { FactionTeamValue } from '../manager/nodeManager';

/*
 * The messages between the game server and its clients, as my_web_wow's WowShared/NetProtocol/NetMessages.cs.
 * The web version runs the server in the page (LocalGameServer), so these are plain objects instead of
 * protobuf messages; the enums are as-const objects with the C# names as values. The faction teams are
 * nodeManager's FactionTeam (the same values as NetFactionTeam).
 */

export const NetBotClass = {
    Melee: 'Melee',
    Caster: 'Caster'
} as const;
export type NetBotClassValue = typeof NetBotClass[keyof typeof NetBotClass];

export const NetSpellType = {
    Frostbolt: 'Frostbolt',
    IceLance: 'IceLance',
    Pyroblast: 'Pyroblast',
    IceMissile: 'IceMissile',
    LightningBolt: 'LightningBolt',
    Blizzard: 'Blizzard',
    FrostNova: 'FrostNova',
    IceBlock: 'IceBlock',
    Polymorph: 'Polymorph',
    Counterspell: 'Counterspell',
    Kick: 'Kick',
    MeleeAttack: 'MeleeAttack',   // auto-attack
    MeleeSpecial: 'MeleeSpecial'  // special melee attack
} as const;
export type NetSpellTypeValue = typeof NetSpellType[keyof typeof NetSpellType];

export const NetSpellSchool = {
    Arcane: 'Arcane',
    Frost: 'Frost',
    Fire: 'Fire',
    Lightning: 'Lightning'
} as const;
export type NetSpellSchoolValue = typeof NetSpellSchool[keyof typeof NetSpellSchool];

export const NetAnimationType = {
    Idle: 'Idle',
    Run: 'Run',
    Walk: 'Walk',
    Attack: 'Attack',
    Attack2: 'Attack2',
    Attack3: 'Attack3',
    Attack4: 'Attack4',
    Attack5: 'Attack5',
    Attack6: 'Attack6',
    AttackSpecial: 'AttackSpecial',
    SpellCast: 'SpellCast',
    SpellCast2: 'SpellCast2',
    SpellCast3: 'SpellCast3',
    SpellCasted: 'SpellCasted',
    Die: 'Die',
    GettingHit: 'GettingHit',
    Stunned: 'Stunned',
    StrafeLeft: 'StrafeLeft',
    StrafeRight: 'StrafeRight'
} as const;
export type NetAnimationTypeValue = typeof NetAnimationType[keyof typeof NetAnimationType];

export const NetBotState = {
    Idle: 'Idle',
    Wandering: 'Wandering',
    Chasing: 'Chasing',
    Attacking: 'Attacking',
    Casting: 'Casting',
    Channeling: 'Channeling',
    IceBlocked: 'IceBlocked',
    Frozen: 'Frozen',   // frost nova'd
    Polymorphed: 'Polymorphed',
    Dead: 'Dead',
    Evading: 'Evading'  // giving up on target
} as const;
export type NetBotStateValue = typeof NetBotState[keyof typeof NetBotState];

export const NetSpellVisualPhase = {
    CastStart: 'CastStart',
    CastComplete: 'CastComplete',
    CastCancel: 'CastCancel',
    ProjectileFire: 'ProjectileFire',
    AreaEffect: 'AreaEffect',
    ChannelStart: 'ChannelStart',
    ChannelEnd: 'ChannelEnd'
} as const;
export type NetSpellVisualPhaseValue = typeof NetSpellVisualPhase[keyof typeof NetSpellVisualPhase];

export const NetSoundType = {
    Polymorph: 'Polymorph',
    FrostNova: 'FrostNova',
    IceBlock: 'IceBlock',
    Frostbolt: 'Frostbolt',
    Pyroblast: 'Pyroblast',
    IceLance: 'IceLance',
    MeleeHit: 'MeleeHit',
    SpellHit: 'SpellHit',
    Death: 'Death',
    Resurrect: 'Resurrect'
} as const;
export type NetSoundTypeValue = typeof NetSoundType[keyof typeof NetSoundType];

export type NetVec3 = [number, number, number];

// ========================= Server -> Client Messages =========================

export interface ServerHello {
    playerId: number;        // assigned entity ID for this client
    mapId: number;
    expansion: string;       // "classic", "tbc", "wotlk"
    deathmatch: boolean;     // FreeForAll otherwise
    botCount: number;
    tickRate: number;        // server ticks per second
    devMode: boolean;
}

export interface NetEntityState {
    id: number;
    displayId: number;
    modelPath: string;
    scale: number;
    position: NetVec3;
    rotation: number;     // yaw in radians
    health: number;
    healthMax: number;
    mana: number;
    manaMax: number;
    team: FactionTeamValue;
    isDead: boolean;
    isPlayer: boolean;    // true = human player, false = bot
    botClass: NetBotClassValue;

    // Animation / visual state
    animation: NetAnimationTypeValue;
    isCasting: boolean;
    castProgress: number; // 0..1
    castingSpell: NetSpellTypeValue | null;
    isChanneling: boolean;
    channelProgress: number; // 1..0 (drains)

    // Status effects
    isPolymorphed: boolean;
    isFrozenByNova: boolean;
    isIceBlocked: boolean;
    isAutoAttacking: boolean;

    // Target
    targetId: number | null;

    // Bot state (for debug HUD)
    botState: NetBotStateValue;

    // Polymorphed model override
    polymorphModelPath: string | null;
    polymorphDisplayId: number;
}

export interface NetBlizzardZone {
    casterId: number;
    position: NetVec3;
    radius: number;
    timeRemaining: number;
}

export interface NetPath {
    entityId: number;
    points: NetVec3[];
}

export interface WorldSnapshot {
    entities: NetEntityState[];
    serverTime: number;

    // Resurrection timer
    ressTimerRemaining: number;   // seconds until next ress
    ressTimerTotal: number;       // total cycle (30s)

    // Deathmatch scores
    allianceKills: number;
    hordeKills: number;

    // Active blizzard circles (for ground indicators)
    blizzardZones: NetBlizzardZone[];

    // Active paths for debug drawing
    debugPaths: NetPath[];
}

export interface NetSpellVisualEvent {
    casterId: number;
    targetId: number | null;
    spellType: NetSpellTypeValue;
    phase: NetSpellVisualPhaseValue;
    targetPosition: NetVec3 | null;  // for blizzard/frost nova
    sourcePosition: NetVec3 | null;  // projectile origin
    travelTime: number;
}

export interface NetDamageEvent {
    sourceId: number;
    targetId: number;
    amount: number;
    isCrit: boolean;
    spellType: NetSpellTypeValue;
    isHeal: boolean;
    travelTime: number;
}

export interface NetEntityDied {
    entityId: number;
    killerId: number;
}

export interface NetSoundStub {
    soundType: NetSoundTypeValue;
    entityId: number;
    description: string;
}
