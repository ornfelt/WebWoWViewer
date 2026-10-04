/*
 * The game server's settings, as my_web_wow's WowServer/ServerConfig.cs (with its defaults). The map,
 * expansion, mode, bot count and dev mode come from the viewer (config / the map params) instead of the
 * command line.
 */

export const MeleeModels = [
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

export const CasterModels = [
    [26563, "creature/skeletonnaked/skeletonnaked.m2"],
    [112,   "creature/orcmalewarriorlight/orcmalewarriorlight.m2"],
    [1021,  "creature/tempdeathguard/deathguard.m2"],
];

export const PolymorphDisplayId = 856;
export const PolymorphModelPath = "creature/sheep/sheep.m2";

class ServerConfig {
    constructor(mapId, expansion, deathmatch, botCount, devMode) {
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
    getMeleeModels() {
        var excluded = new Set();
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
