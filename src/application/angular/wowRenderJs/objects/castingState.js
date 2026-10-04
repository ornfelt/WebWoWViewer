/*
 * Tracks the state of a spell currently being cast (non-instant spells), as my_web_wow's CastingState.cs.
 * The casting state lives on SpellManager and is consumed by the HUD for the cast bar.
 */
class CastingState {
    constructor(type, castTime, onComplete) {
        this.spellType = type;
        this.castTime = castTime;
        this.elapsed = 0;
        this.onComplete = onComplete;
    }

    get isComplete() {
        return this.elapsed >= this.castTime;
    }

    get progress() {
        return this.castTime > 0 ? Math.min(Math.max(this.elapsed / this.castTime, 0), 1) : 1;
    }

    /* Advance the cast timer. Returns true if the cast just completed this tick. deltaTime is in milliseconds. */
    update(deltaTime) {
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
