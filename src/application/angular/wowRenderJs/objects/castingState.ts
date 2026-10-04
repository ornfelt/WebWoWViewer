import type { SpellTypeValue } from './spellDefinitions';

/*
 * Tracks the state of a spell currently being cast (non-instant spells), as my_web_wow's CastingState.cs.
 * The casting state lives on SpellManager and is consumed by the HUD for the cast bar.
 */
class CastingState {
    spellType: SpellTypeValue;
    castTime: number; // total cast time in seconds
    elapsed: number;  // seconds elapsed
    onComplete: () => void;

    constructor(type: SpellTypeValue, castTime: number, onComplete: () => void) {
        this.spellType = type;
        this.castTime = castTime;
        this.elapsed = 0;
        this.onComplete = onComplete;
    }

    get isComplete(): boolean {
        return this.elapsed >= this.castTime;
    }

    get progress(): number {
        return this.castTime > 0 ? Math.min(Math.max(this.elapsed / this.castTime, 0), 1) : 1;
    }

    /* Advance the cast timer. Returns true if the cast just completed this tick. deltaTime is in milliseconds. */
    update(deltaTime: number): boolean {
        if (this.isComplete) return false;

        this.elapsed += deltaTime / 1000;
        if (this.isComplete) {
            this.onComplete();
            return true;
        }
        return false;
    }
}

export default CastingState;
