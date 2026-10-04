import {vec3} from 'gl-matrix'
import WorldPlayer from './worldObjects/worldPlayer'
import { HIDDEN_POS } from './spellProjectile'
import type { SceneApi } from '../sceneApi';
import type WorldObjectManager from '../manager/worldObjectManager';
import type { AreaEffectPhaseConfig } from './spellDefinitions';

function createEffectModel(sceneApi: SceneApi, worldObjectManager: WorldObjectManager, modelPath: string, objectMapKey: number): WorldPlayer {
    var wp = new WorldPlayer(sceneApi);
    wp.setDisplayId(-1);
    wp.setNativeDisplayId(-1);
    wp.modelPathInput = modelPath;
    wp.setScale(1.0);
    wp.setRotation(0);
    wp.complete();
    worldObjectManager.objectMap[objectMapKey] = wp;
    wp.setPosition(vec3.clone(HIDDEN_POS));
    return wp;
}

/*
 * A non-projectile spell effect that spawns at a position and despawns after a duration, as my_web_wow's
 * AreaEffect.cs. Multi-phase effects (e.g. Frost Nova: area model for 1s, then state model for 5s) pass
 * their phases; single-model effects (e.g. Ice Block) pass a model path and a duration, as the C#'s two
 * constructors.
 */
class AreaEffect {
    // Phase management (multi-phase mode)
    phases: AreaEffectPhaseConfig[] | null;
    phaseModels: WorldPlayer[];
    currentPhaseIndex: number;
    phaseTimer: number;

    // Single-model mode (ice block)
    singleModel: WorldPlayer | null;
    singleDuration: number;

    isActive: boolean;
    effectPosition: vec3;

    constructor(sceneApi: SceneApi, worldObjectManager: WorldObjectManager, phasesOrModelPath: AreaEffectPhaseConfig[] | string,
                objectMapKeyBase: number, duration = 0) {
        this.phaseModels = [];
        this.currentPhaseIndex = 0;
        this.phaseTimer = 0;
        this.singleModel = null;
        this.singleDuration = duration;
        this.effectPosition = vec3.create();

        if (typeof phasesOrModelPath !== 'string') {
            this.phases = phasesOrModelPath;
            for (var i = 0; i < phasesOrModelPath.length; i++) {
                this.phaseModels.push(createEffectModel(sceneApi, worldObjectManager, phasesOrModelPath[i].modelPath, objectMapKeyBase + i));
            }
        } else {
            this.phases = null;
            this.singleModel = createEffectModel(sceneApi, worldObjectManager, phasesOrModelPath, objectMapKeyBase);
        }

        this.isActive = false;
    }

    /* Activate the effect at the given position. */
    activate(position: vec3) {
        vec3.copy(this.effectPosition, position);
        this.isActive = true;

        if (this.phases !== null) {
            // Multi-phase mode
            this.currentPhaseIndex = 0;
            this.phaseTimer = 0;
            // Show first phase, hide others
            for (var i = 0; i < this.phaseModels.length; i++) {
                if (i == 0)
                    this.phaseModels[i].setPosition(vec3.clone(position));
                else
                    this.phaseModels[i].setPosition(vec3.clone(HIDDEN_POS));
            }
        } else {
            // Single model mode
            this.phaseTimer = 0;
            this.singleModel!.setPosition(vec3.clone(position));
        }
    }

    /* Force-cancel the effect immediately. */
    cancel() {
        this.hideAll();
        this.isActive = false;
    }

    update(deltaTime: number) {
        if (!this.isActive) return;

        var dt = deltaTime / 1000; // deltaTime is in ms
        this.phaseTimer += dt;

        if (this.phases !== null) {
            // Multi-phase mode
            if (this.currentPhaseIndex < this.phases.length) {
                if (this.phaseTimer >= this.phases[this.currentPhaseIndex].duration) {
                    // Hide current phase
                    this.phaseModels[this.currentPhaseIndex].setPosition(vec3.clone(HIDDEN_POS));
                    this.currentPhaseIndex++;
                    this.phaseTimer = 0;

                    if (this.currentPhaseIndex < this.phases.length) {
                        // Show next phase
                        this.phaseModels[this.currentPhaseIndex].setPosition(vec3.clone(this.effectPosition));
                    } else {
                        // All phases done
                        this.isActive = false;
                    }
                }
            }
        } else {
            // Single model mode
            if (this.phaseTimer >= this.singleDuration) {
                this.singleModel!.setPosition(vec3.clone(HIDDEN_POS));
                this.isActive = false;
            }
        }
    }

    hideAll() {
        if (this.phases !== null) {
            for (var m of this.phaseModels)
                m.setPosition(vec3.clone(HIDDEN_POS));
        } else if (this.singleModel !== null) {
            this.singleModel.setPosition(vec3.clone(HIDDEN_POS));
        }
    }
}

export default AreaEffect;
