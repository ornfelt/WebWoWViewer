import MDXObject from './M2Object';
import type { CheckDepthFunc } from './M2Object';
import type WmoObject from './wmoObject';
import config from './../../services/config'
import mathHelper from './../math/mathHelper';
import {mat4, vec4, vec3} from 'gl-matrix';
import type {ReadonlyMat4, ReadonlyVec4} from 'gl-matrix';
import type { WmoDoodad } from '../../services/map/wmoLoader';
import type { SceneApi } from '../sceneApi';

class WmoM2Object extends MDXObject {
    /* assigned through self in the constructor */
    useLocalLighting!: boolean;
    wmoObject!: WmoObject | null;
    /* set by load() */
    doodad!: WmoDoodad;
    diffuseColor!: Float32Array;
    /* set by createPlacementMatrix() */
    placementInvertMatrix!: mat4;
    /* set by calcOwnPosition() */
    position!: vec4;

    constructor(sceneApi: SceneApi) {
        super(sceneApi);

        var self = this;
        self.sceneApi = sceneApi;
        self.currentDistance = 0;
        self.isRendered = true;
        self.useLocalLighting = true;
        self.wmoObject = null;
    }

    setWmoObject(value: WmoObject) {
        this.wmoObject = value;
    }
    getDiffuseColor() {
        return (this.useLocalLighting) ? this.diffuseColor : new Float32Array([1,1,1,1])
    }
    getInvertModelMatrix() {
        return this.placementInvertMatrix;
    }
    checkFrustumCulling (cameraVec4: ReadonlyVec4, frustumPlanes: ReadonlyVec4[], num_planes: number): boolean {
        if (!this.loaded) {
            return true;
        }
        var inFrustum = super.checkFrustumCulling(cameraVec4, frustumPlanes, num_planes);
        return inFrustum;
    }
    // @ts-expect-error overrides MDXObject.checkAgainstDepthBuffer with a different signature (no placementMatrix); ported as-is
    checkAgainstDepthBuffer(frustumMatrix: ReadonlyMat4, lookAtMat4: ReadonlyMat4, getDepth: CheckDepthFunc) {
        this.setIsRendered(this.getIsRendered() && super.checkAgainstDepthBuffer(frustumMatrix, lookAtMat4, this.placementMatrix, getDepth));
    }

    drawTransparentMeshes () {
        var diffuseColor = this.getDiffuseColor();
        this.draw(true, this.placementMatrix, diffuseColor);
    }
    drawNonTransparentMeshes () {
        var diffuseColor = this.getDiffuseColor();
        this.draw(false, this.placementMatrix, diffuseColor);
    }
    drawInstancedNonTransparentMeshes (instanceCount: number, placementVBO: WebGLBuffer) {
        this.drawInstanced(false, instanceCount, placementVBO);
    }
    drawInstancedTransparentMeshes (instanceCount: number, placementVBO: WebGLBuffer) {
        this.drawInstanced(true, instanceCount, placementVBO);
    }
    drawBB () {
        super.drawBB([0.819607843, 0.058, 0.058])
    }

    createPlacementMatrix (doodad: WmoDoodad, wmoPlacementMatrix: mat4){
        var placementMatrix = mat4.create();
        mat4.identity(placementMatrix);
        mat4.multiply(placementMatrix, placementMatrix, wmoPlacementMatrix);

        mat4.translate(placementMatrix, placementMatrix, [doodad.pos.x,doodad.pos.y,doodad.pos.z]);

        var orientMatrix = mat4.create();
        mat4.fromQuat(orientMatrix,
            [doodad.rotation.imag.x,
            doodad.rotation.imag.y,
            doodad.rotation.imag.z,
            doodad.rotation.real]
        );
        mat4.multiply(placementMatrix, placementMatrix, orientMatrix);

        mat4.scale(placementMatrix, placementMatrix, [doodad.scale, doodad.scale, doodad.scale]);

        var placementInvertMatrix = mat4.create();
        mat4.invert(placementInvertMatrix, placementMatrix);

        this.placementInvertMatrix = placementInvertMatrix;
        this.placementMatrix = placementMatrix;
    }
    calcOwnPosition () {
        var position = vec4.fromValues(0,0,0,1 );
        vec4.transformMat4(position, position, this.placementMatrix);

        this.position = position;
    }
    setUseLocalLighting(value: boolean) {
        this.useLocalLighting = value;
    }
    getCurrentDistance (){
        return this.currentDistance;
    }
    getDiameter () {
        return this.diameter;
    }
    setIsRendered (value: boolean) {
        this.isRendered = value;
    }
    // JS-BUG: useLocalColor is never used, so the false that WmoObject passes (through loadWmoM2Obj) never reaches setUseLocalLighting - doodads keep useLocalLighting = true
    // @ts-expect-error overrides MDXObject.load with a different signature; startLoading() calls MDXObject.prototype.load directly
    load (doodad: WmoDoodad, wmoPlacementMatrix: mat4, useLocalColor: boolean){
        var self = this;

        self.doodad = doodad;

        var color = doodad.color;
        var diffuseColorVec4 = [color&0xff, (color>> 8)&0xff,
            (color>>16)&0xff, (color>> 24)&0xff];
        diffuseColorVec4[0] /= 255.0; diffuseColorVec4[1] /= 255.0;
        diffuseColorVec4[2] /= 255.0; diffuseColorVec4[3] /= 255.0;

        self.diffuseColor = new Float32Array(diffuseColorVec4);


        self.createPlacementMatrix(doodad, wmoPlacementMatrix);
        self.calcOwnPosition();

        return super.setLoadParams(doodad.modelName, 0);
    }
}

export default WmoM2Object;