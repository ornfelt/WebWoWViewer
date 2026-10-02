/*
 * The animations the player character plays, a part of my_web_wow's AnimationType enum (the movement ones;
 * my_web_wow also has the spell, attack and emote ones). The values are the enum names.
 */
export const AnimationType = {
    Run: 'Run',
    StrafeLeft: 'StrafeLeft',
    StrafeRight: 'StrafeRight',
    Fall: 'Fall',
    Idle: 'Idle',
    JumpStart: 'JumpStart',
};

/*
 * Tracks which animation the player should be playing based on movement, as the movement part of
 * my_web_wow's PlayerAnimationState (without the casting / forced animations of its spells).
 * Call evaluate() each frame after updating the movement flags; it returns the desired animation
 * when it changes. The caller applies it to the model.
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

        // Current animation being played (avoids re-setting every frame)
        this.currentAnim = AnimationType.Idle;
    }

    /* True if the player is performing any movement (WASD) */
    get isMoving() {
        return this.isMovingForward || this.isMovingBackward || this.isStrafingLeft || this.isStrafingRight;
    }

    /* The desired animation based on the current state, or null if unchanged. Call this each frame. */
    evaluate() {
        var desired;

        // Priority: jump > fall > movement > idle
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
