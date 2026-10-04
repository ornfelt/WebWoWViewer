/*
 * The animations the player character plays, a part of my_web_wow's AnimationType enum (the movement and
 * spell ones; my_web_wow also has the attack and emote ones). The values are the enum names.
 */
export const AnimationType = {
    Run: 'Run',
    StrafeLeft: 'StrafeLeft',
    StrafeRight: 'StrafeRight',
    Fall: 'Fall',
    Idle: 'Idle',
    JumpStart: 'JumpStart',
    // turning in place (web: A / D turn the character in player mode); AnimationData.dbc names
    ShuffleLeft: 'ShuffleLeft',
    ShuffleRight: 'ShuffleRight',
    // casting (SpellManager)
    SpellCast: 'SpellCast',
    SpellCast2: 'SpellCast2',
    SpellCasted: 'SpellCasted',
    // the game server's units (MultiplayerManager)
    Walk: 'Walk',
    Attack: 'Attack',
    Attack2: 'Attack2',
    Attack3: 'Attack3',
    Attack4: 'Attack4',
    Attack5: 'Attack5',
    Attack6: 'Attack6',
    AttackSpecial: 'AttackSpecial',
    SpellCast3: 'SpellCast3',
    Die: 'Die',
    GettingHit: 'GettingHit',
    Stunned: 'Stunned',
};

/* how long the cast-complete animation plays before returning to idle, in seconds */
const ForcedAnimDuration = 0.5;

/*
 * Tracks which animation the player should be playing based on movement and casting state, as
 * my_web_wow's PlayerAnimationState. Call evaluate() each frame after updating the movement flags and
 * casting state; it returns the desired animation when it changes. The caller applies it to the model.
 */
class PlayerAnimationState {
    constructor() {
        // Movement flags (set from the camera)
        this.isMovingForward = false;
        this.isMovingBackward = false;
        this.isStrafingLeft = false;
        this.isStrafingRight = false;
        this.isJumping = false;
        this.isFalling = false;
        this.isTurningLeft = false;
        this.isTurningRight = false;

        // Spell state (set by SpellManager callbacks)
        this.isCasting = false;
        this.isChanneling = false;

        // Current animation being played (avoids re-setting every frame)
        this.currentAnim = AnimationType.Idle;

        // Forced animation with timer (for spellcasted / one-shot anims)
        this.forcedAnim = null;
        this.forcedAnimTimer = 0;
        // Cast-specific animation
        this.castAnim = null;
    }

    /* True if the player is performing any movement (WASD) */
    get isMoving() {
        return this.isMovingForward || this.isMovingBackward || this.isStrafingLeft || this.isStrafingRight;
    }

    /* Called when a cast starts. Sets the casting animation. */
    onCastStart(anim) {
        this.castAnim = anim;
        this.isCasting = true;
        this.forcedAnim = null; // cancel any forced anim
    }

    /* Called when a cast completes successfully (not canceled): plays the cast-complete animation briefly before returning to idle/move. */
    onCastComplete(completeAnim) {
        this.isCasting = false;
        this.isChanneling = false;
        this.castAnim = null;
        this.forcedAnim = completeAnim;
        this.forcedAnimTimer = ForcedAnimDuration;
    }

    /* Called when a cast is canceled (e.g. movement). */
    onCastCanceled() {
        this.isCasting = false;
        this.isChanneling = false;
        this.castAnim = null;
        this.forcedAnim = null;
    }

    /* Called when channeling starts. */
    onChannelStart(anim) {
        this.castAnim = anim;
        this.isChanneling = true;
        this.forcedAnim = null;
    }

    /* The desired animation based on the current state, or null if unchanged. Call this each frame; deltaTime is in milliseconds. */
    evaluate(deltaTime) {
        // Tick down forced animation timer
        if (this.forcedAnim !== null) {
            this.forcedAnimTimer -= deltaTime / 1000;
            if (this.forcedAnimTimer <= 0)
                this.forcedAnim = null;
        }

        var desired;

        // Movement cancels casting
        if (this.isMoving && (this.isCasting || this.isChanneling)) {
            this.isCasting = false;
            this.isChanneling = false;
            this.castAnim = null;
            // The SpellManager.cancelCast() should also be called externally
        }

        // Priority: jump > fall > movement > forced anim > casting > turning in place > idle
        if (this.isJumping) {
            desired = AnimationType.JumpStart;
        } else if (this.isFalling) {
            desired = AnimationType.Fall;
        } else if (this.isMoving) {
            // Run when moving forward/backward; strafe anims only for pure left/right.
            if (this.isMovingForward || this.isMovingBackward)
                desired = AnimationType.Run;
            else if (this.isStrafingLeft)
                desired = AnimationType.StrafeLeft;
            else if (this.isStrafingRight)
                desired = AnimationType.StrafeRight;
            else
                desired = AnimationType.Run; // fallback
        } else if (this.forcedAnim !== null) {
            desired = this.forcedAnim;
        } else if (this.isCasting || this.isChanneling) {
            desired = this.castAnim ?? AnimationType.SpellCast;
        } else if (this.isTurningLeft) {
            desired = AnimationType.ShuffleLeft;
        } else if (this.isTurningRight) {
            desired = AnimationType.ShuffleRight;
        } else {
            desired = AnimationType.Idle;
        }

        if (desired !== this.currentAnim) {
            this.currentAnim = desired;
            return desired;
        }

        return null; // no change
    }
}

export default PlayerAnimationState;
