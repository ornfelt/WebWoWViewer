import MDXObject from './M2Object';
import type { CheckDepthFunc } from './M2Object';
import mathHelper from './../math/mathHelper';

import {mat4, vec4, vec3, glMatrix} from 'gl-matrix';
import type {ReadonlyMat4, ReadonlyVec4} from 'gl-matrix';
import type { Vector3f } from '../../services/fileReadHelper';
import type { AdtM2Placement } from '../../services/map/adtLoader';
import type { SceneApi } from '../sceneApi';


class AdtM2Object extends MDXObject {
    /* set by load() */
    mddf!: AdtM2Placement;
    diffuseColor!: Float32Array;
    /* set by createPlacementMatrix() */
    placementInvertMatrix!: mat4;
    /* set by calcOwnPosition() */
    position!: vec4;

    /* the scene graph manager passes only sceneApi */
    constructor(sceneApi: SceneApi, localBB?: [Vector3f, Vector3f]){
        // JS-BUG: localBB is passed to the one-parameter MDXObject constructor, which ignores it (and no caller passes it); harmless
        // @ts-expect-error MDXObject's constructor takes one argument; ported as-is
        super(sceneApi, localBB);

        var self = this;
        self.sceneApi = sceneApi;
        self.currentDistance = 0;
        self.isRendered = true;
    }

    getDiffuseColor() {
        return this.diffuseColor;
    }
    getInvertModelMatrix() {
        return this.placementInvertMatrix;
    }
    drawBB (){
       super.drawBB([0.819607843, 0.058, 0.058])
    }
    drawTransparentMeshes () {
        super.draw(true, this.placementMatrix, this.diffuseColor);
    }
    drawNonTransparentMeshes () {
        super.draw(false, this.placementMatrix, this.diffuseColor);
    }
    draw () {
        // JS-BUG: the drawTransparent argument is missing - placementMatrix lands in drawTransparent and diffuseColor in placementMatrix (probably meant draw(false, ...)); nothing calls AdtM2Object.draw() today
        // @ts-expect-error MDXObject.draw takes (drawTransparent, placementMatrix, diffuseColor); ported as-is
        super.draw(this.placementMatrix, this.diffuseColor);
    }
    drawInstancedNonTransparentMeshes (instanceCount: number, placementVBO: WebGLBuffer) {
        // JS-BUG: drawInstanced takes three arguments; the 0xffffffff here and below is ignored - harmless
        // @ts-expect-error drawInstanced takes three arguments; ported as-is
        super.drawInstanced(false, instanceCount, placementVBO, 0xffffffff);
    }
    drawInstancedTransparentMeshes (instanceCount: number, placementVBO: WebGLBuffer) {
        // @ts-expect-error drawInstanced takes three arguments; ported as-is
        super.drawInstanced(true, instanceCount, placementVBO, 0xffffffff);
    }
    checkFrustumCullingAndSet (cameraVec4: ReadonlyVec4, frustumPlanes: ReadonlyVec4[], num_planes: number) {
        var inFrustum = this.checkFrustumCulling(cameraVec4, frustumPlanes, num_planes);
        this.setIsRendered(this.getIsRendered() && inFrustum);
    }
    checkFrustumCulling (cameraVec4: ReadonlyVec4, frustumPlanes: ReadonlyVec4[], num_planes: number): boolean {
        if (!this.loaded) {
            return true;
        }
        var inFrustum = super.checkFrustumCulling(cameraVec4, frustumPlanes, num_planes);
        return inFrustum;
    }
    // @ts-expect-error overrides MDXObject.checkAgainstDepthBuffer with a different signature (no placementMatrix); ported as-is
    checkAgainstDepthBuffer(frustrumMatrix: ReadonlyMat4, lookAtMat4: ReadonlyMat4, getDepth: CheckDepthFunc) {
        this.setIsRendered(this.getIsRendered() && super.checkAgainstDepthBuffer(frustrumMatrix, lookAtMat4, this.placementMatrix, getDepth));
    }
    createPlacementMatrix (mddf: AdtM2Placement){
        var TILESIZE = 533.333333333;

        var posx = 32*TILESIZE - mddf.pos.x;
        var posy = mddf.pos.y;
        var posz = 32*TILESIZE - mddf.pos.z;

        var placementMatrix = mat4.create();
        mat4.identity(placementMatrix);

        mat4.rotateX(placementMatrix, placementMatrix, glMatrix.toRadian(90));
        mat4.rotateY(placementMatrix, placementMatrix, glMatrix.toRadian(90));

        mat4.translate(placementMatrix, placementMatrix, [posx, posy, posz]);

        mat4.rotateY(placementMatrix, placementMatrix, glMatrix.toRadian(mddf.rotation.y -270));
        mat4.rotateZ(placementMatrix, placementMatrix, glMatrix.toRadian(-mddf.rotation.x));
        mat4.rotateX(placementMatrix, placementMatrix, glMatrix.toRadian(mddf.rotation.z-90));

        mat4.scale(placementMatrix, placementMatrix, [mddf.scale / 1024, mddf.scale / 1024, mddf.scale / 1024]);

        var placementInvertMatrix = mat4.create();
        mat4.invert(placementInvertMatrix, placementMatrix);

        this.placementInvertMatrix = placementInvertMatrix;
        this.placementMatrix = placementMatrix;
    }
    calcOwnPosition () {
        var position = vec4.fromValues(0,0,0,1);
        vec4.transformMat4(position, position, this.placementMatrix);

        this.position = position;
    }
    getCurrentDistance (){
        return this.currentDistance;
    }
    getDiameter () {
        return this.diameter;
    }
    setIsRendered (value: boolean) {
       //if (value === undefined) return;

        this.isRendered = value;
    }
    // @ts-expect-error overrides MDXObject.load with a different signature; startLoading() calls MDXObject.prototype.load directly
    load (mddf: AdtM2Placement){
        var self = this;

        self.mddf = mddf;
        self.diffuseColor = new Float32Array([1,1,1,1]);

        self.createPlacementMatrix(mddf);
        self.calcOwnPosition();
        super.setLoadParams(mddf.fileName, 0);

        //Start loading adtM2 as soon as they spawn
        this.startLoading();

        return
    }
}

export default AdtM2Object;
