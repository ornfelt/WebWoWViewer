import WorldObject from './worldObject'
import {mat4, vec4, vec3, glMatrix} from 'gl-matrix';
import type {ReadonlyQuat, ReadonlyVec4} from 'gl-matrix';
import type { SceneApi } from '../../sceneApi';
import type WorldMDXObject from '../worldM2Object';


class WorldGameObject extends WorldObject {
    sceneApi: SceneApi;
    objectModel: WorldMDXObject | null;
    /* set by setRotationQuaternion() */
    rotationMatrix!: mat4;

    constructor(sceneApi: SceneApi) {
        super();
        this.sceneApi = sceneApi;

        this.objectModel = null;
    }

    setDisplayId(value: number) {
        var godid = this.sceneApi.dbc.getGameObjectDisplayInfoDBC();
        var godidRec = godid[value];
        if (godidRec) {
            var modelName = godidRec.modelName;

            if (modelName.toLowerCase().split('.')[1] == 'mdx') {
                this.objectModel = this.sceneApi.objects.loadWorldM2Obj(modelName, null, null);
            }
        }
    }
    setRotationQuaternion(quaternion: ReadonlyQuat) {
        var rotationMatrix = mat4.create();
        mat4.fromQuat(rotationMatrix, quaternion)

        this.rotationMatrix = rotationMatrix;
    }
    update (deltaTime: number, cameraPos: ReadonlyVec4) {
        var properScale = 1.0;
        if (this.scale! > 0.0001) {
            properScale = this.scale!;
        }

        if (this.objectModel && this.objectModel.m2Geom && this.objectModel.m2Geom.m2File) {
            this.objectModel.createPlacementMatrix(this.pos, this.f, properScale, this.rotationMatrix);

            /* Update bone matrices */
            // JS-BUG: viewMat is not passed on (update() does not take it, though worldObjectManager passes it) - M2Object.update() transforms the model's lights by undefined, a TypeError for a game object model with lights
            // @ts-expect-error objectUpdate takes (deltaTime, cameraPos, viewMat); ported as-is
            this.objectModel.objectUpdate(deltaTime, cameraPos);
        }
    }
}

export default WorldGameObject;