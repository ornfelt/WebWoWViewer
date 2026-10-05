import {vec3} from 'gl-matrix';
import type CollisionWorld from '../collision/collisionWorld';

export interface CameraVecs {
    lookAtVec3: vec3;
    cameraVec3: vec3;
}

function  degToRad(degrees: number): number {
    return degrees * ( Math.PI / 180 );
}

const moveSpeed = 3;
const freeflyZoomStep = 3;

// ---- Collision / gravity (my_web_wow's Camera.cs) ----
const gravity = 19.29;          // yards/s^2 (matches the gfx source project)
const maxFallSpeed = 100;       // terminal velocity (yards/s)
const jumpSpeed = 7.95;         // initial jump velocity (yards/s)
const wallRadius = 0.5;         // sphere radius for wall collision
const wallProbeH = 1.0;         // height above feet to cast wall rays (avoids the floor)
const groundSnap = 3.0;         // max step up / step down to stay grounded
const snapTol = 0.5;            // tolerance when deciding we're on the ground
const underMapMargin = 5.0;     // below (minZ - this) => "under the map"
const spawnSearchDown = 2000;   // how far below the free roam camera to look for the ground when the player mode starts

// Max walkable steepness: cos(50deg). Slopes steeper than this can't be climbed.
const wallClimb = 0.64278764;

// Movement is slower when collision-based movement is active.
const collisionSpeedScale = 0.3;

// Third-person orbit camera around the player (yaw + pitch from the mouse).
const orbitDistanceDefault = 18.0; // default distance from the player
const orbitDistanceMin = 5.0;      // closest zoom
const orbitDistanceMax = 50.0;     // farthest zoom
const zoomStep = 2.5;              // orbit-distance change per wheel notch
const orbitPitchBias = 18.0;       // extra downward pitch so it sits above by default
const lookUp = 2.0;                // look at a point slightly above the feet

// Pitch (av) limits in collision mode so the camera stops instead of flipping over the top.
const orbitAvMin = -75.0;
const orbitAvMax = 65.0;

// Keyboard turning in player mode (A / D, web): WoW's default turn rate (rad/s).
const turnRate = Math.PI;

class Camera {
    camera: vec3;
    MDDepthPlus: number;
    MDDepthMinus: number;
    MDHorizontalPlus: number;
    MDHorizontalMinus: number;
    MDVerticalPlus: number;
    MDVerticalMinus: number;
    depthDiff: number;
    staticCamera: boolean;
    ah: number;
    av: number;
    isShiftHeld: boolean;
    movingForward: boolean;
    movingBackward: boolean;

    // Optional collision world (exported triangles, in wow space). The player mode needs it; without it the
    // camera keeps its free roam behavior.
    collision: CollisionWorld | null;
    // The player mode toggle (web only: my_web_wow is always in player mode when it has triangles).
    usePlayerMode: boolean;

    // In player mode `camera` holds the PLAYER position (feet, on the ground); the rendered camera is
    // computed behind and above it (third person).

    // Persistent fall state for gravity (wow space, +Z is up).
    verticalVelocity: number;
    // True when the player is resting on a collision triangle (not falling).
    grounded: boolean;
    // True while the player is airborne from a jump (ascending).
    isJumping: boolean;
    // True while the player is airborne and descending (falling).
    isFalling: boolean;

    // Third-person zoom (distance from the player), adjusted by the mouse wheel.
    orbitDistance: number;

    // Facing of the character model (radians, matching -ah * pi/180). Only follows the
    // camera while right-mouse is held (see turnWithCamera).
    characterYaw: number;

    // Set by the input handler while the RIGHT mouse button is held: the character turns
    // to follow the camera direction (WoW right-click steering).
    turnWithCamera: boolean;

    // Set while the LEFT mouse button is held: free-look. The camera orbits but the
    // character keeps its facing (and moving does not re-orient it).
    freeLook: boolean;

    // Last third-person eye we emitted; used to ignore the per-frame echo that Scene
    // feeds back through setCameraPos (so it doesn't overwrite the player position).
    lastEye: vec3;

    constructor () {
        this.camera = [0, 0, 0];
        this.MDDepthPlus = 0;
        this.MDDepthMinus = 0;
        this.MDHorizontalPlus = 0;
        this.MDHorizontalMinus = 0;

        this.MDVerticalPlus = 0;
        this.MDVerticalMinus = 0;

        this.depthDiff = 0;

        this.staticCamera = false;

        this.ah = 0;
        this.av = 0;

        // Speed boost
        this.isShiftHeld = false;
        this.movingForward = false;
        this.movingBackward = false;

        this.collision = null;
        this.usePlayerMode = false;
        this.verticalVelocity = 0;
        this.grounded = false;
        this.isJumping = false;
        this.isFalling = false;
        this.orbitDistance = orbitDistanceDefault;
        this.characterYaw = 0;
        this.turnWithCamera = false;
        this.freeLook = false;
        this.lastEye = [NaN, NaN, NaN];
    }

    /* true when collision triangles are loaded for the map, so the player mode can be used */
    get collisionAvailable(): boolean {
        return this.collision !== null && !this.collision.empty;
    }
    /* true when collision data is available and drives movement (the player mode is on) */
    get collisionActive(): boolean {
        return this.usePlayerMode && this.collisionAvailable;
    }
    /* player (collision) position in wow space; the same as the camera position in free roam */
    get playerPosition(): vec3 {
        return this.camera;
    }

    /* true if the player is actively moving forward / backward / strafing */
    get isMovingForward(): boolean {
        return this.MDDepthPlus > 0;
    }
    get isMovingBackward(): boolean {
        return this.MDDepthMinus > 0;
    }
    /* A / D strafe in free roam, and turn the character in player mode */
    get isStrafingLeft(): boolean {
        return !this.collisionActive && this.MDHorizontalMinus > 0;
    }
    get isStrafingRight(): boolean {
        return !this.collisionActive && this.MDHorizontalPlus > 0;
    }
    get isTurningLeft(): boolean {
        return this.collisionActive && this.MDHorizontalMinus > 0;
    }
    get isTurningRight(): boolean {
        return this.collisionActive && this.MDHorizontalPlus > 0;
    }
    /* true if any movement key is pressed */
    get isMoving(): boolean {
        return this.isMovingForward || this.isMovingBackward || this.isStrafingLeft || this.isStrafingRight;
    }

    /*
     * Switches between the free roam camera and the player character (web only; the player mode needs
     * collision triangles). The player starts on the ground below the free roam camera, facing the camera
     * direction; leaving the player mode keeps the third-person eye as the free roam camera.
     */
    setPlayerMode(enabled: boolean) {
        if (enabled && !this.collisionAvailable) return;
        if (enabled === this.usePlayerMode) return;

        this.usePlayerMode = enabled;
        this.verticalVelocity = 0;
        this.grounded = false;
        this.isJumping = false;
        this.isFalling = false;

        if (enabled) {
            // the scene feeds the free roam camera back through setCameraPos on the next frame; ignore it
            this.lastEye = vec3.clone(this.camera);

            var ground = this.collision!.groundBelow(this.camera, groundSnap, spawnSearchDown);
            if (ground !== null) {
                this.camera = [this.camera[0], this.camera[1], ground.groundZ];
            }
            this.characterYaw = degToRad(-this.ah);
        }
    }

    get currentSpeed(): number {
        return this.isShiftHeld ? moveSpeed * 10 : moveSpeed;
    }

    addDepthDiff(val: number) {
        this.depthDiff = this.depthDiff + val;
    }
    // Mouse-wheel zoom. In player mode it changes the third-person orbit distance (clamped);
    // in free roam it moves forward / backward by wheel notches. Positive = scroll up (zoom in).
    zoom(wheelDelta: number) {
        if (this.collisionActive) {
            this.orbitDistance -= wheelDelta * zoomStep; // scroll up -> zoom in
            if (this.orbitDistance < orbitDistanceMin) this.orbitDistance = orbitDistanceMin;
            else if (this.orbitDistance > orbitDistanceMax) this.orbitDistance = orbitDistanceMax;
        } else {
            this.addDepthDiff(wheelDelta * freeflyZoomStep);
        }
    }
    addHorizontalViewDir(val: number) {
        var ah = this.ah;
        ah += val;

        this.ah = ah;
    }
    addVerticalViewDir(val: number) {
        var av = this.av;
        av += val;

        if (av < -89.99999) {
            av = -89.99999
        } else if (av > 89.99999) {
            av = 89.99999;
        }
        this.av = av;
    }
    /* points the camera along dir (world space): the angles tick() turns +x by (av around y, positive looks
     * down, then -ah around z) */
    setLookDirection(dir: ArrayLike<number>) {
        var length = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
        if (length < 1e-6) return;
        var av = Math.asin(Math.min(Math.max(-dir[2] / length, -1), 1)) * 180 / Math.PI;
        this.av = Math.min(Math.max(av, -89.99999), 89.99999);
        this.ah = -Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
    }

    startMovingForward(){
        this.movingForward = true;
        this.MDDepthPlus = this.currentSpeed;
    }
    stopMovingForward(){
        this.movingForward = false;
        this.MDDepthPlus = 0;
    }
    startMovingBackwards(){
        this.movingBackward = true;
        this.MDDepthMinus = this.currentSpeed;
    }
    stopMovingBackwards(){
        this.movingBackward = false;
        this.MDDepthMinus = 0;
    }
    setShiftHeld(held: boolean){
        this.isShiftHeld = held;

        if (this.movingForward)
            this.MDDepthPlus = this.currentSpeed;
        if (this.movingBackward)
            this.MDDepthMinus = this.currentSpeed;
    }

    startStrafingLeft(){
        this.MDHorizontalMinus = 1;
    }
    stopStrafingLeft(){
        this.MDHorizontalMinus = 0;
    }
    startStrafingRight(){
        this.MDHorizontalPlus = 1;
    }
    stopStrafingRight(){
        this.MDHorizontalPlus = 0;
    }

    startMovingUp(){
        this.MDVerticalPlus = 1;
    }
    stopMovingUp(){
        this.MDVerticalPlus = 0;
    }
    startMovingDown(){
        this.MDVerticalMinus = 1;
    }
    stopMovingDown(){
        this.MDVerticalMinus = 0;
    }


    tick (timeDelta: number): CameraVecs {
        var dir: vec3 = [1, 0, 0];
        var moveSpeed = 0.02;
        var camera = this.camera;

        var dTime = timeDelta;

        var horizontalDiff = dTime * moveSpeed * (this.MDHorizontalPlus - this.MDHorizontalMinus);
        var depthDiff      = dTime * moveSpeed * (this.MDDepthPlus - this.MDDepthMinus) + this.depthDiff;
        var verticalDiff   = dTime * moveSpeed * (this.MDVerticalPlus - this.MDVerticalMinus);

        this.depthDiff = 0;

        /* Calc look at position */
        dir = vec3.rotateY(dir, dir, [0, 0, 0], degToRad(this.av));
        dir = vec3.rotateZ(dir, dir, [0, 0, 0], degToRad(-this.ah));
        vec3.normalize(dir,dir);

        /* Collision-based movement + gravity (player mode, only when triangles are loaded) */
        if (this.collisionActive) {
            return this.tickWithCollision(timeDelta, horizontalDiff, depthDiff, verticalDiff);
        }

        var lookat: vec3 = [];

        /* Calc camera position */
        if (horizontalDiff != 0) {
            var right: vec3 = [];
            vec3.rotateZ(right, dir, [0, 0, 0], degToRad(-90));
            right[2] = 0;

            vec3.normalize(right, right);
            vec3.scale(right, right, horizontalDiff);

            vec3.add(camera, camera, right);
        }

        if (depthDiff !== 0) {
            var movDir: vec3 = [];
            vec3.copy(movDir, dir);

            vec3.scale(movDir, movDir, depthDiff);
            vec3.add(camera, camera, movDir);
        }
        if (verticalDiff !== 0) {
            camera[2] = camera[2] + verticalDiff;
        }

        vec3.add(lookat, camera, dir);

        return {
            lookAtVec3: lookat,
            cameraVec3: camera
        }
    }
    /*
     * Resolves this tick's movement against the loaded collision triangles and applies gravity.
     * In this mode `camera` holds the PLAYER position (feet, on the ground); the rendered camera
     * (the returned cameraVec3) is placed behind and above it.
     */
    tickWithCollision(timeDelta: number, horizontalDiff: number, depthChange: number, verticalDiff: number): CameraVecs {
        var world = this.collision!;
        var dt = Math.min(timeDelta / 1000, 0.05); // seconds, clamped so fast falls can't tunnel

        // Collision-based movement is slower than free roam.
        horizontalDiff *= collisionSpeedScale;
        depthChange *= collisionSpeedScale;
        verticalDiff *= collisionSpeedScale;

        // Clamp pitch so the orbit camera stops at the top/bottom instead of flipping over.
        if (this.av < orbitAvMin) this.av = orbitAvMin;
        else if (this.av > orbitAvMax) this.av = orbitAvMax;

        // Keyboard turning (A / D, web; my_web_wow strafes): the character turns in place instead of
        // strafing, and the camera turns with it unless left-mouse free-look holds the camera.
        var turn = this.MDHorizontalMinus - this.MDHorizontalPlus; // + is left (counter-clockwise)
        if (turn !== 0) {
            var turnRad = turn * turnRate * dt;
            this.characterYaw += turnRad;
            if (!this.freeLook)
                this.ah -= turnRad * 180 / Math.PI;
        }
        horizontalDiff = 0;

        // Character facing: follows the camera yaw ONLY while right-mouse steering.
        // Otherwise the character keeps its facing; moving (W) goes along that facing
        // and the camera can be rotated independently (left-mouse free-look).
        if (this.turnWithCamera)
            this.characterYaw = degToRad(-this.ah);

        // 1) Horizontal movement (WASD), relative to the CHARACTER facing (so free-look
        //    doesn't change where W goes), projected onto the ground plane.
        var forward: vec3 = [1, 0, 0];
        vec3.rotateZ(forward, forward, [0, 0, 0], this.characterYaw);
        forward[2] = 0;
        if (vec3.squaredLength(forward) > 1e-6) vec3.normalize(forward, forward);
        var rightDir: vec3 = [];
        vec3.rotateZ(rightDir, forward, [0, 0, 0], degToRad(-90));
        rightDir[2] = 0;
        if (vec3.squaredLength(rightDir) > 1e-6) vec3.normalize(rightDir, rightDir);

        var horiz = vec3.create();
        if (horizontalDiff !== 0) vec3.scaleAndAdd(horiz, horiz, rightDir, horizontalDiff);
        if (depthChange !== 0) vec3.scaleAndAdd(horiz, horiz, forward, depthChange);

        if (vec3.squaredLength(horiz) > 0) {
            var before = vec3.clone(this.camera);

            // Cast wall rays from knee height (not the feet) so we don't snag on the floor;
            // keep only the resolved XY, vertical is handled by gravity / ground snap.
            var probe = vec3.fromValues(this.camera[0], this.camera[1], this.camera[2] + wallProbeH);
            probe = world.slideMove(probe, horiz, wallRadius);
            this.camera[0] = probe[0];
            this.camera[1] = probe[1];

            // Slope limit: don't allow climbing onto ground that is too steep and higher
            // than where we stand (you can still slide/walk down or across gentle slopes).
            var dest = world.groundBelow(this.camera, groundSnap, groundSnap);
            if (dest !== null) {
                var tooSteep = dest.normal[2] < wallClimb;
                var uphill = dest.groundZ > before[2] + snapTol;
                if (tooSteep && uphill) {
                    this.camera[0] = before[0];
                    this.camera[1] = before[1];
                }
            }
        }

        // 2) Vertical movement.
        var wantUp = verticalDiff > 0;
        var zBeforeVertical = this.camera[2];
        if (verticalDiff !== 0) {
            // Manual up/down (fly): collision-aware, and it suspends gravity for this
            // frame so the keys stay responsive. Gravity resumes once released.
            this.verticalVelocity = 0;
            var probe = vec3.fromValues(this.camera[0], this.camera[1], this.camera[2] + wallProbeH);
            var moved = world.slideMove(probe, [0, 0, verticalDiff], wallRadius);
            this.camera[2] += moved[2] - probe[2];
        } else {
            // Gravity: accelerate downward; ground snap below corrects penetration.
            this.verticalVelocity -= gravity * dt;
            if (this.verticalVelocity < -maxFallSpeed) this.verticalVelocity = -maxFallSpeed;
            this.camera[2] += this.verticalVelocity * dt;

            // Past the apex the jump is over; the descent is "falling".
            if (this.isJumping && this.verticalVelocity <= 0)
                this.isJumping = false;
        }

        // 3) Ground detection / snapping. The player's feet rest exactly on the ground.
        //    Only snap when descending/level (not while still rising from a jump).
        //    The probe starts at least as high as where this frame's fall started, so a fall step
        //    longer than groundSnap (fast falls at a low frame rate) can't pass through the ground.
        var groundSearchUp = Math.max(groundSnap, zBeforeVertical - this.camera[2] + snapTol);
        var ground = (!wantUp && this.verticalVelocity <= 0) ? world.groundBelow(this.camera, groundSearchUp, groundSnap) : null;
        if (ground !== null) {
            if (this.camera[2] <= ground.groundZ + snapTol) {
                this.camera[2] = ground.groundZ;
                this.verticalVelocity = 0;
                this.grounded = true;
                this.isJumping = false; // landed
            } else {
                this.grounded = false;
            }
        } else {
            this.grounded = false;
        }

        // 4) "Under the map" safety net: below all triangles => respawn on a random one.
        if (this.camera[2] < world.minZ - underMapMargin) {
            this.camera = world.randomTopPosition(0.1);
            this.verticalVelocity = 0;
            this.grounded = true;
            this.isJumping = false;
        }

        // Falling = airborne and not in the ascending jump phase.
        this.isFalling = !this.grounded && !this.isJumping;

        // 5) Third-person orbit camera (yaw + pitch from the mouse), behind/above the player.
        var camDir: vec3 = [1, 0, 0];
        vec3.rotateY(camDir, camDir, [0, 0, 0], degToRad(this.av + orbitPitchBias));
        vec3.rotateZ(camDir, camDir, [0, 0, 0], degToRad(-this.ah));
        vec3.normalize(camDir, camDir);

        var lookAt = vec3.fromValues(this.camera[0], this.camera[1], this.camera[2] + lookUp);
        var eye = vec3.scaleAndAdd(vec3.create(), lookAt, camDir, -this.orbitDistance);
        this.lastEye = vec3.clone(eye);

        return {
            lookAtVec3: lookAt,
            cameraVec3: eye
        }
    }

    /* Requests a jump (player mode). Only jumps when grounded; isJumping drives the jump animation. */
    requestJump() {
        if (!this.collisionActive) return;
        if (!this.grounded) return;

        this.verticalVelocity = jumpSpeed;
        this.grounded = false;
        this.isJumping = true;
    }

    /*
     * Sets the camera position directly (in world space). In player mode this sets the PLAYER
     * position (e.g. teleports). The per-frame echo of the third-person eye that Scene feeds
     * back is ignored so it doesn't clobber the player position.
     */
    setCameraPos (x: number, y: number, z: number) {
        if (this.collisionActive && x === this.lastEye[0] && y === this.lastEye[1] && z === this.lastEye[2])
            return;

        this.camera = [x, y, z];
        this.verticalVelocity = 0;
    }

}

export default Camera
