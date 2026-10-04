/*
 * The game server's settings, as my_web_wow's WowServer/ServerConfig.cs (with its defaults). The map,
 * expansion, mode, bot count and dev mode come from the viewer (config / the map params) instead of the
 * command line.
 */

/* [display id, model path] */
export type ServerModel = [number, string];

export const MeleeModels: ServerModel[] = [
    [11121, "creature/ragnaros/ragnaros.m2"],
    [21135, "creature/illidan/illidan.m2"],
    [19708, "creature/bloodelfguard/bloodelfmale_guard.m2"],
    [24978, "creature/northrendpenguin/northrendpenguin.m2"],  // wotlk only
    [8570,  "creature/dragon/dragononyxia.m2"],
    [11380, "creature/dragon/dragonnefarian.m2"],
    [20539, "creature/netherdrake/netherdrakeoutland.m2"],
    [24725, "creature/netherdrake/netherdrakeelite.m2"],
    [5645,  "creature/drake/drake.m2"],
];

export const CasterModels: ServerModel[] = [
    [26563, "creature/skeletonnaked/skeletonnaked.m2"],
    [112,   "creature/orcmalewarriorlight/orcmalewarriorlight.m2"],
    [1021,  "creature/tempdeathguard/deathguard.m2"],
];

export const PolymorphDisplayId = 856;
export const PolymorphModelPath = "creature/sheep/sheep.m2";

class ServerConfig {
    // Network
    tickRate: number; // ticks per second

    // Game
    mapId: number;
    expansion: string;
    deathmatch: boolean; // FreeForAll otherwise
    botCount: number;
    devMode: boolean;  // bots don't attack player

    // Combat tuning
    baseHealth: number;
    baseMana: number;
    meleeSwingTime: number;       // seconds
    meleeSpecialDelay: number;    // seconds to land
    meleeRange: number;           // units
    spellRange: number;           // units
    chaseRange: number;           // max distance to start chasing
    leashRange: number;           // give up chasing beyond this
    aggroRange: number;           // detection range
    frostNovaRange: number;       // AoE freeze radius
    blizzardRadius: number;       // blizzard AoE radius
    blizzardTickInterval: number; // damage every N seconds

    // Cooldowns (seconds)
    frostNovaCooldown: number;
    iceBlockCooldown: number;
    polymorphCooldown: number;
    counterspellCooldown: number;
    kickCooldown: number;
    blizzardCooldown: number;

    // Durations
    iceBlockDuration: number;
    frostNovaDuration: number;
    polymorphDuration: number;
    schoolLockoutDuration: number;

    // Damage ranges (min, max)
    meleeAutoMinDmg: number;
    meleeAutoMaxDmg: number;
    meleeSpecialMinDmg: number;
    meleeSpecialMaxDmg: number;
    frostboltMinDmg: number;
    frostboltMaxDmg: number;
    iceLanceMinDmg: number;
    iceLanceMaxDmg: number;
    pyroblastMinDmg: number;
    pyroblastMaxDmg: number;
    iceMissileMinDmg: number;
    iceMissileMaxDmg: number;
    lightningBoltMinDmg: number;
    lightningBoltMaxDmg: number;
    blizzardTickMinDmg: number;
    blizzardTickMaxDmg: number;
    critChance: number;           // 15%
    critMultiplier: number;

    // Resurrection
    ressurectionInterval: number; // seconds

    // Bot AI tuning
    botMoveSpeed: number;
    botWanderWaitMin: number;
    botWanderWaitMax: number;
    botGiveUpChanceBase: number;     // per tick at max range
    botRetargetInterval: number;     // seconds between target scans
    botCastDecisionInterval: number; // seconds between spell decisions

    // Debug
    verboseBotLog: boolean;
    sendDebugPaths: boolean;

    // Player default model
    playerDisplayId: number;
    playerModelPath: string;
    playerScale: number;

    constructor(mapId: number, expansion: string, deathmatch: boolean, botCount: number, devMode: boolean) {
        this.tickRate = 20;

        this.mapId = mapId;
        this.expansion = expansion;
        this.deathmatch = deathmatch;
        this.botCount = botCount;
        this.devMode = devMode;

        this.baseHealth = 5000;
        this.baseMana = 3000;
        this.meleeSwingTime = 1.6;
        this.meleeSpecialDelay = 0.5;
        this.meleeRange = 5;
        this.spellRange = 50;
        this.chaseRange = 50;
        this.leashRange = 100;
        this.aggroRange = 70;
        this.frostNovaRange = 8;
        this.blizzardRadius = 10;
        this.blizzardTickInterval = 1;

        this.frostNovaCooldown = 30;
        this.iceBlockCooldown = 60;
        this.polymorphCooldown = 12;
        this.counterspellCooldown = 30;
        this.kickCooldown = 20;
        this.blizzardCooldown = 15;

        this.iceBlockDuration = 7;
        this.frostNovaDuration = 6;
        this.polymorphDuration = 6;
        this.schoolLockoutDuration = 3;

        this.meleeAutoMinDmg = 150;
        this.meleeAutoMaxDmg = 280;
        this.meleeSpecialMinDmg = 350;
        this.meleeSpecialMaxDmg = 600;
        this.frostboltMinDmg = 400;
        this.frostboltMaxDmg = 600;
        this.iceLanceMinDmg = 200;
        this.iceLanceMaxDmg = 350;
        this.pyroblastMinDmg = 800;
        this.pyroblastMaxDmg = 1200;
        this.iceMissileMinDmg = 250;
        this.iceMissileMaxDmg = 400;
        this.lightningBoltMinDmg = 350;
        this.lightningBoltMaxDmg = 550;
        this.blizzardTickMinDmg = 100;
        this.blizzardTickMaxDmg = 200;
        this.critChance = 0.15;
        this.critMultiplier = 2.0;

        this.ressurectionInterval = 30;

        this.botMoveSpeed = 7;
        this.botWanderWaitMin = 1;
        this.botWanderWaitMax = 4;
        this.botGiveUpChanceBase = 0.005;
        this.botRetargetInterval = 5;
        this.botCastDecisionInterval = 0.8;

        this.verboseBotLog = false;
        this.sendDebugPaths = true;

        this.playerDisplayId = 26563;
        this.playerModelPath = "creature/skeletonnaked/skeletonnaked.m2";
        this.playerScale = 1.0;
    }

    /* the melee models, without the ones the expansion does not have */
    getMeleeModels(): ServerModel[] {
        var excluded = new Set<number>();
        if (this.expansion !== "wotlk")
            excluded.add(24978); // penguin
        if (this.expansion === "classic") {
            excluded.add(20539); // netherdrake outland
            excluded.add(24725); // netherdrake elite
        }
        return MeleeModels.filter((m) => !excluded.has(m[0]));
    }
}

export default ServerConfig;
