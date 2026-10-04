import type AnimationManager from './animationManager';
import type { AnimationDataRecord } from '../../services/dbc/animationDataDBC';
import type { AnimationTypeValue } from './playerAnimationState';

const maxFallbackHops = 15;

/* AnimationType values -> their AnimationData.dbc names (the movement and spell part of my_web_wow's AnimationNameMapping) */
const nameByType: { [type in AnimationTypeValue]?: string } = {
    Run: 'Run',
    StrafeLeft: 'WalkLeft',    // could also be "StrafeLeft" depending on DBC
    StrafeRight: 'WalkRight',  // could also be "StrafeRight"
    Fall: 'Fall',
    Idle: 'Stand',
    JumpStart: 'JumpStart',
    SpellCast: 'ReadySpellOmni',
    SpellCast2: 'SpellCastOmni',
    SpellCasted: 'SpellCastOmni',
};

/* lower-case AnimationData.dbc name -> record, built once per loaded DBC */
let recordsByName: Map<string, AnimationDataRecord> | null = null;
let recordsByNameSource: AnimationDataRecord[] | null = null;

function getRecordByName(animationData: AnimationDataRecord[], name: string): AnimationDataRecord | undefined {
    if (recordsByNameSource !== animationData) {
        recordsByName = new Map();
        for (const record of animationData) {
            // the DBC array is indexed by id, so it has holes
            if (record) recordsByName.set(record.name.toLowerCase(), record);
        }
        recordsByNameSource = animationData;
    }
    return recordsByName!.get(name.toLowerCase());
}

/*
 * Safely set an animation on an AnimationManager by resolving the AnimationType through the
 * AnimationData.dbc name -> id -> fallback chain. Returns true if a valid animation was found.
 * Based on my_web_wow's AnimationBridge.SetAnimationSafe.
 */
export function setAnimationSafe(animManager: AnimationManager, animType: AnimationTypeValue,
                                 animationData: AnimationDataRecord[], isFlying = false): boolean {
    // Step 1: Resolve AnimationType -> target name
    let targetName = nameByType[animType] ?? animType;

    // Step 2: Flying prefix
    if (isFlying)
        targetName = 'Fly' + targetName;

    // Step 3: Resolve name -> DBC animation ID (name not in DBC: try the raw animType name as fallback)
    const startRecord = getRecordByName(animationData, targetName) ?? getRecordByName(animationData, animType);
    if (startRecord === undefined)
        return false;

    // Step 4: Walk the DBC fallback chain until we find one the model has
    const visited = new Set<number>();
    let currentId = startRecord.id;
    let hops = 0;

    while (true) {
        if (visited.has(currentId)) break; // cycle guard
        visited.add(currentId);
        if (hops++ > maxFallbackHops) break; // depth guard

        // Try to set this animation ID on the manager
        if (animManager.setAnimationId(currentId))
            return true;

        // Not found on the model -> step to fallback
        const rec = animationData[currentId];
        if (!rec)
            break; // no record for the current id

        const fallbackId = rec.fallbackID;
        if (fallbackId === 0) {
            // Try animation ID 0 (Stand) as final fallback; if 0 isn't present either, stop without changing
            return animManager.setAnimationId(0);
        }

        currentId = fallbackId; // continue chain
    }

    // Exhausted the chain without finding a match
    return false;
}
