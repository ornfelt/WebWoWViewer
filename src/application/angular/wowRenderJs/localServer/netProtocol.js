/*
 * The messages between the game server and its clients, as my_web_wow's WowShared/NetProtocol/NetMessages.cs.
 * The web version runs the server in the page (LocalGameServer), so these are plain objects instead of
 * protobuf messages; the enums are as-const objects with the C# names as values. The faction teams are
 * nodeManager's FactionTeam (the same values as NetFactionTeam).
 */

export const NetBotClass = {
    Melee: 'Melee',
    Caster: 'Caster'
};

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
};

export const NetSpellSchool = {
    Arcane: 'Arcane',
    Frost: 'Frost',
    Fire: 'Fire',
    Lightning: 'Lightning'
};

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
};

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
};

export const NetSpellVisualPhase = {
    CastStart: 'CastStart',
    CastComplete: 'CastComplete',
    CastCancel: 'CastCancel',
    ProjectileFire: 'ProjectileFire',
    AreaEffect: 'AreaEffect',
    ChannelStart: 'ChannelStart',
    ChannelEnd: 'ChannelEnd'
};

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
};

// ========================= Server -> Client Messages =========================
