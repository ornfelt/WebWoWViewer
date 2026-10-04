import {vec3, mat4} from 'gl-matrix'
import WorldPlayer from './worldObjects/worldPlayer'
import type { SceneApi } from '../sceneApi';
import type WorldObjectManager from '../manager/worldObjectManager';

/* where hidden spell models wait, far away from everything */
export const HIDDEN_POS = vec3.fromValues(-99999, -99999, -99999);

const BODY_AIM_LIFT = 1.5; // ideally tuned based on model scale

/*
 * One spell model flying from its origin to a (moving) target unit, as my_web_wow's SpellProjectile.cs.
 * onArrive (web addition) is called with the target key when it arrives, for the damage on hit.
 */
class SpellProjectile {
    worldPlayer: WorldPlayer;
    worldObjectManager: WorldObjectManager;
    modelPath: string;
    objectMapKey: number;

    isActive: boolean;
    startPos: vec3;
    targetPos: vec3;
    speed: number;
    arrivalThreshold: number;
    baseRotationCorrection: mat4 | null;

    // The target WorldUnit key in objectMap (so we can read its live position)
    targetObjectKey: number | null;

    onArrive: ((targetKey: number) => void) | null;

    constructor(sceneApi: SceneApi, worldObjectManager: WorldObjectManager, modelPath: string, objectMapKey: number,
                speed = 60, arrivalThreshold = 3, baseRotationCorrection: mat4 | null = null) {
        this.worldObjectManager = worldObjectManager;
        this.modelPath = modelPath;
        this.objectMapKey = objectMapKey;
        this.speed = speed;
        this.arrivalThreshold = arrivalThreshold;
        this.baseRotationCorrection = baseRotationCorrection;
        this.isActive = false;
        this.startPos = vec3.create();
        this.targetPos = vec3.create();
        this.targetObjectKey = null;
        this.onArrive = null;

        // Create the WorldPlayer that renders the spell model
        this.worldPlayer = new WorldPlayer(sceneApi);
        this.worldPlayer.setDisplayId(-1);
        this.worldPlayer.setNativeDisplayId(-1);
        this.worldPlayer.modelPathInput = modelPath;
        this.worldPlayer.setScale(1.0);
        this.worldPlayer.setRotation(0);
        this.worldPlayer.complete();

        // Add to objectMap but keep it hidden initially
        worldObjectManager.objectMap[objectMapKey] = this.worldPlayer;
        this.hide();
    }

    fire(origin: vec3, targetKey: number) {
        vec3.copy(this.startPos, origin);
        this.targetObjectKey = targetKey;

        // Read current target position
        var targetUnit = this.worldObjectManager.objectMap[targetKey];
        if (targetUnit) {
            vec3.copy(this.targetPos, targetUnit.getPosition());
            this.targetPos[2] += BODY_AIM_LIFT;
        } else {
            vec3.copy(this.targetPos, origin); // fallback
        }

        this.worldPlayer.setPosition(vec3.clone(origin));
        this.isActive = true;
    }

    /* Fire with a one-shot speed override (for server-driven travel time). */
    fireWithSpeed(origin: vec3, targetKey: number, overrideSpeed: number) {
        this.speed = overrideSpeed;
        this.fire(origin, targetKey);
    }

    update(deltaTime: number) {
        if (!this.isActive) return;

        // track live target position
        if (this.targetObjectKey !== null) {
            var targetUnit = this.worldObjectManager.objectMap[this.targetObjectKey];
            if (targetUnit) {
                vec3.copy(this.targetPos, targetUnit.getPosition());
                this.targetPos[2] += BODY_AIM_LIFT;
            }
        }

        var currentPos = this.worldPlayer.getPosition();
        var direction = vec3.subtract(vec3.create(), this.targetPos, currentPos);
        var distance = vec3.length(direction);

        if (distance <= this.arrivalThreshold) {
            // Arrived
            this.hide();
            if (this.onArrive && this.targetObjectKey !== null) this.onArrive(this.targetObjectKey);
            return;
        }

        var normalizedDir = vec3.scale(vec3.create(), direction, 1 / distance);
        var step = this.speed * (deltaTime / 1000); // deltaTime is in ms
        if (step > distance) step = distance;

        var newPos = vec3.scaleAndAdd(vec3.create(), currentPos, normalizedDir, step);
        this.worldPlayer.setPosition(newPos);

        var yaw = Math.atan2(normalizedDir[1], normalizedDir[0]);

        if (this.baseRotationCorrection !== null) {
            // the correction first, then the yaw (C#: baseRotationCorrection * yawMatrix with row vectors)
            var finalRotation = mat4.fromZRotation(mat4.create(), yaw);
            mat4.multiply(finalRotation, finalRotation, this.baseRotationCorrection);
            this.worldPlayer.setRotation(yaw);
            this.worldPlayer.setRotationMatrix(finalRotation);
        } else {
            this.worldPlayer.clearRotationMatrix();
            this.worldPlayer.setRotation(yaw);
        }
    }

    hide() {
        this.isActive = false;
        // Move it far away so it's not visible / culled
        this.worldPlayer.setPosition(vec3.clone(HIDDEN_POS));
    }
}

export default SpellProjectile;
