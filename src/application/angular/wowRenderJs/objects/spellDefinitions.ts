import {mat4} from 'gl-matrix'
import { AnimationType } from '../manager/playerAnimationState';
import type { AnimationTypeValue } from '../manager/playerAnimationState';

/*
 * The player's spells, as my_web_wow's SpellDefinitions.cs. The damage ranges are the ones of the
 * multiplayer server (WowServer's ServerConfig); the web version applies them locally on hit.
 */

export const SpellType = {
    Frostbolt: 'Frostbolt',
    IceLance: 'IceLance',
    Pyroblast: 'Pyroblast',
    IceMissile: 'IceMissile',
    LightningBolt: 'LightningBolt',
    Blizzard: 'Blizzard',
    FrostNova: 'FrostNova',
    IceBlock: 'IceBlock'
} as const;
export type SpellTypeValue = typeof SpellType[keyof typeof SpellType];

export const SpellCategory = {
    Projectile: 'Projectile',     // flies from caster to target
    AreaAtPlayer: 'AreaAtPlayer', // spawns on the player (frost nova, ice block)
    AreaAtTarget: 'AreaAtTarget'  // spawns at target location (blizzard)
} as const;
export type SpellCategoryValue = typeof SpellCategory[keyof typeof SpellCategory];

export interface AreaEffectPhaseConfig {
    modelPath: string;
    duration: number; // seconds
}

export interface SpellDefinition {
    type: SpellTypeValue;
    modelPath: string;
    category: SpellCategoryValue;
    speed: number;                 // projectile speed (only for Projectile category)
    castTime: number;              // seconds, 0 = instant
    isChanneled: boolean;          // blizzard-style: spawns immediately, channels for duration
    channelDuration: number;       // seconds (only for channeled)
    arrivalThreshold: number;      // projectile arrival distance
    baseRotationCorrection: mat4 | null;

    // For AreaAtPlayer effects with phases (frost nova)
    phases: AreaEffectPhaseConfig[] | null;

    // For single-duration AreaAtPlayer effects (ice block)
    areaDuration: number;

    // Animation to use while casting / channeling
    castAnimation: AnimationTypeValue;
    castCompleteAnimation: AnimationTypeValue | null; // null = no completion anim (channeled spells)

    // Damage on hit (ServerConfig), [min, max]; null = no damage
    damage: [number, number] | null;
}

/* the multiplayer server's crit chance and multiplier (ServerConfig.CritChance / CritMultiplier) */
export const CritChance = 0.15;
export const CritMultiplier = 2.0;

/* Blizzard damages every unit within this radius of its position, once a second (ServerConfig) */
export const BlizzardRadius = 10;
export const BlizzardTickInterval = 1;

function spell(def: Partial<SpellDefinition> & Pick<SpellDefinition, 'type' | 'modelPath' | 'category'>): SpellDefinition {
    return Object.assign({
        speed: 0,
        castTime: 0,
        isChanneled: false,
        channelDuration: 0,
        arrivalThreshold: 0,
        baseRotationCorrection: null,
        phases: null,
        areaDuration: 0,
        castAnimation: AnimationType.SpellCast,
        castCompleteAnimation: AnimationType.SpellCasted,
        damage: null
    }, def);
}

export const allSpellDefinitions: SpellDefinition[] = [
    spell({
        type: SpellType.Frostbolt,
        modelPath: "SPELLS\\Frostbolt.m2",
        category: SpellCategory.Projectile,
        speed: 20,
        castTime: 1.2,
        baseRotationCorrection: mat4.fromYRotation(mat4.create(), 90 * Math.PI / 180),
        arrivalThreshold: 3,
        damage: [400, 600]
    }),
    spell({
        type: SpellType.IceLance,
        modelPath: "spells\\Ice_Lance_Missile.mdx",
        category: SpellCategory.Projectile,
        speed: 80,
        castTime: 0, // instant
        arrivalThreshold: 3,
        damage: [200, 350]
    }),
    spell({
        type: SpellType.Pyroblast,
        modelPath: "SPELLS\\PyroBlast_Missile.m2",
        category: SpellCategory.Projectile,
        speed: 80,
        castTime: 3.5,
        arrivalThreshold: 3,
        damage: [800, 1200]
    }),
    spell({
        type: SpellType.IceMissile,
        modelPath: "spells\\Ice_Missile_Uber.mdx",
        category: SpellCategory.Projectile,
        speed: 60,
        castTime: 1.5,
        arrivalThreshold: 3,
        damage: [250, 400]
    }),
    spell({
        type: SpellType.LightningBolt,
        modelPath: "spells\\LightningBolt_Missile.mdx",
        category: SpellCategory.Projectile,
        speed: 60,
        castTime: 1.2,
        arrivalThreshold: 3,
        damage: [350, 550]
    }),
    spell({
        type: SpellType.Blizzard,
        modelPath: "spells\\Blizzard_Impact_Base.mdx",
        category: SpellCategory.AreaAtTarget,
        isChanneled: true,
        channelDuration: 5,
        castAnimation: AnimationType.SpellCast2,
        castCompleteAnimation: null, // no completion anim for channeled
        damage: [100, 200] // per tick
    }),
    spell({
        type: SpellType.FrostNova,
        modelPath: "spells\\Frost_Nova_area.mdx", // phase 1 model
        category: SpellCategory.AreaAtPlayer,
        castTime: 0, // instant
        phases: [
            { modelPath: "spells\\Frost_Nova_area.mdx", duration: 1 },
            { modelPath: "spells\\Frost_Nova_state.mdx", duration: 5 }
        ]
    }),
    spell({
        type: SpellType.IceBlock,
        modelPath: "spells\\IceBarrier_State.mdx",
        category: SpellCategory.AreaAtPlayer,
        castTime: 0, // instant
        areaDuration: 7
    })
];

export function getSpellDefinition(type: SpellTypeValue): SpellDefinition | null {
    for (var def of allSpellDefinitions)
        if (def.type === type)
            return def;
    return null;
}
