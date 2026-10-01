import MDXObject from './M2Object';
import type { M2MaterialTexture } from './M2Object';
import config from './../../services/config'
import mathHelper from './../math/mathHelper';
import {mat4, vec4, vec3, glMatrix} from 'gl-matrix';
import type {ReadonlyMat4, ReadonlyVec3, ReadonlyVec4} from 'gl-matrix';
import type { SceneApi } from '../sceneApi';

class WorldMDXObject extends MDXObject {
    diffuseColor: Float32Array;
    /* set by createPlacementMatrix() / createPlacementMatrixFromParent() */
    placementInvertMatrix!: mat4;

    constructor(sceneApi: SceneApi){
        super(sceneApi);
        this.diffuseColor = new Float32Array([1,1,1,1]);
        this.aabb = null;
    }
    calcDistance (position: ReadonlyVec4) {
        this.currentDistance = 0;
    }
    getIsInstancable() {
        return false;
    }
    getCurrentDistance(){
        return 0;
    }
    setIsRendered (value: boolean) {
        //if (value === undefined) return;

        this.isRendered = value;
    }
    getDiameter () {
        return 100;
    }
    getDiffuseColor(){
        return new Float32Array([1,1,1,1]);
    }
    getInvertModelMatrix() {
        return this.placementInvertMatrix;
    }

    update (deltaTime: number, cameraPos: ReadonlyVec4, viewMat: ReadonlyMat4) {

    }
    objectUpdate (deltaTime: number, cameraPos: ReadonlyVec4, viewMat: ReadonlyMat4) {
        if (!this.getIsRendered()) return;
        super.update(deltaTime, cameraPos, viewMat);
    }
    createAABB() {
        if (!this.placementMatrix || !this.loaded) {
            return
        }
        super.createAABB();
    }
    checkFrustumCulling (cameraVec4: ReadonlyVec4, frustumPlanes: ReadonlyVec4[], num_planes: number): boolean {
        if (!this.aabb) return false;
        if (!this.loaded) return true;

        return super.checkFrustumCulling(cameraVec4, frustumPlanes, num_planes);
    }

    overrideModelTexture(texture: M2MaterialTexture) {
        var self = this;
        var mdxObject = this.m2Geom;
        var skinObject = this.skinGeom;

        for (var i = 0; i < this.materialArray.length; i++) {
            var material = this.materialArray[i];
            var mdxTextureDefinition1 = mdxObject.m2File.textureDefinition[material.mdxTextureIndex1];
            if (mdxTextureDefinition1 && mdxTextureDefinition1.texType == 1) {
                material.texUnit1Texture = texture;
            }
            var mdxTextureDefinition2 = mdxObject.m2File.textureDefinition[material.mdxTextureIndex2!];
            if (mdxTextureDefinition2 && mdxTextureDefinition2.texType == 1) {
                material.texUnit2Texture = texture;
            }
            var mdxTextureDefinition3 = mdxObject.m2File.textureDefinition[material.mdxTextureIndex3!];
            if (mdxTextureDefinition3 && mdxTextureDefinition3.texType == 1) {
                material.texUnit3Texture = texture;
            }
        }
    }


    createPlacementMatrix (pos: ReadonlyVec3, f: number, scale: number, rotationMatrix?: ReadonlyMat4){
        var placementMatrix = mat4.create();
        mat4.identity(placementMatrix);

        mat4.translate(placementMatrix, placementMatrix, pos);

        if (rotationMatrix) {
            mat4.multiply(placementMatrix,placementMatrix, rotationMatrix);
        } else {
            mat4.rotateZ(placementMatrix, placementMatrix, f);
        }

        mat4.scale(placementMatrix, placementMatrix, [scale , scale , scale ]);

        var placementInvertMatrix = mat4.create();
        mat4.invert(placementInvertMatrix, placementMatrix);

        this.placementInvertMatrix = placementInvertMatrix;
        this.placementMatrix = placementMatrix;

        this.createAABB();
    }
    createPlacementMatrixFromParent (parentM2: WorldMDXObject, attachment: number, scale: number){
        var parentM2File = parentM2.m2Geom.m2File;
        var attIndex = parentM2File.attachLookups![attachment];
        var attachInfo = parentM2File.attachments![attIndex];


        if (!attachInfo) {
            debugger;
        }

        var boneId = attachInfo.bone;
        var parentBoneTransMat = parentM2.bonesMatrices[boneId];

        var placementMatrix = mat4.create();
        mat4.identity(placementMatrix);
        mat4.multiply(placementMatrix,placementMatrix, parentM2.placementMatrix);

        mat4.multiply(placementMatrix, placementMatrix, parentBoneTransMat);
        mat4.translate(placementMatrix, placementMatrix, [
            attachInfo.pos.x,
            attachInfo.pos.y,
            attachInfo.pos.z,
            0
        ]);

        var placementInvertMatrix = mat4.create();
        mat4.invert(placementInvertMatrix, placementMatrix);

        this.placementInvertMatrix = placementInvertMatrix;
        this.placementMatrix = placementMatrix;

        this.createAABB();
    }

    /* Draw functions */

    drawTransparentMeshes () {
        this.draw(true, this.placementMatrix, this.diffuseColor);
    }
    drawNonTransparentMeshes () {
        this.draw(false, this.placementMatrix, this.diffuseColor);
    }
    drawInstancedNonTransparentMeshes (instanceCount: number, placementVBO: WebGLBuffer) {
        this.drawInstanced(false, instanceCount, placementVBO);
    }
    drawInstancedTransparentMeshes (instanceCount: number, placementVBO: WebGLBuffer) {
        this.drawInstanced(true, instanceCount, placementVBO);
    }

}

export default WorldMDXObject;
