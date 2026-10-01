import {vec3} from 'gl-matrix';

export interface CameraVecs {
    lookAtVec3: vec3;
    cameraVec3: vec3;
}

function  degToRad(degrees: number): number {
    return degrees * ( Math.PI / 180 );
}

const moveSpeed = 3;
const freeflyZoomStep = 3;

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
    }

    get currentSpeed(): number {
        return this.isShiftHeld ? moveSpeed * 10 : moveSpeed;
    }

    addDepthDiff(val: number) {
        this.depthDiff = this.depthDiff + val;
    }
    // move forward / backward by wheel notches (scroll up -> zoom in)
    zoom(wheelDelta: number) {
        this.addDepthDiff(wheelDelta * freeflyZoomStep);
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
    setCameraPos (x: number, y: number, z: number) {
        this.camera = [x, y, z];
    }

}

export default Camera
