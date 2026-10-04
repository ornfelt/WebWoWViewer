import {vec3} from 'gl-matrix'
import WorldPlayer from './worldObjects/worldPlayer.js'
import { HIDDEN_POS } from './spellProjectile.js'

/*
 * A channeled spell that spawns a model at the target location immediately and persists while the player
 * channels (up to a max duration, or canceled by movement), as my_web_wow's ChanneledSpell.cs.
 */
class ChanneledSpell {
    constructor(sceneApi, worldObjectManager, modelPath, objectMapKey, maxDuration) {
        this.maxDuration = maxDuration;

        this.effectModel = new WorldPlayer(sceneApi);
        this.effectModel.setDisplayId(-1);
        this.effectModel.setNativeDisplayId(-1);
        this.effectModel.modelPathInput = modelPath;
        this.effectModel.setScale(1.0);
        this.effectModel.setRotation(0);
        this.effectModel.complete();

        worldObjectManager.objectMap[objectMapKey] = this.effectModel;
        this.effectModel.setPosition(vec3.clone(HIDDEN_POS));

        this.isActive = false;
        this.elapsed = 0;
    }

    /* Progress 0..1 (how much channeling time has elapsed relative to max); a channeling bar shows 1 - progress as it drains. */
    get progress() {
        return this.maxDuration > 0 ? Math.min(Math.max(this.elapsed / this.maxDuration, 0), 1) : 0;
    }

    /* Remaining time in seconds. */
    get timeRemaining() {
        return Math.max(0, this.maxDuration - this.elapsed);
    }

    /* Begin channeling at the given target position. */
    start(targetPosition) {
        this.effectModel.setPosition(vec3.clone(targetPosition));
        this.elapsed = 0;
        this.isActive = true;
    }

    /* Cancel channeling immediately (e.g. player moved). */
    cancel() {
        this.effectModel.setPosition(vec3.clone(HIDDEN_POS));
        this.isActive = false;
    }

    /* Called each frame. deltaTime is in milliseconds. */
    update(deltaTime) {
        if (!this.isActive) return;

        this.elapsed += deltaTime / 1000;

        if (this.elapsed >= this.maxDuration) {
            this.cancel();
        }
    }
}

export default ChanneledSpell;
