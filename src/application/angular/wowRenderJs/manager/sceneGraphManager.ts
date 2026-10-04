
import adtObjectFactory from './../objects/adtObject';
import adtM2ObjectFactory from './../objects/adtM2Object';
import wmoM2ObjectFactory from '../objects/wmoM2Object';
import WorldMDXObject from '../objects/worldM2Object';
import WmoObject from '../objects/wmoObject';

import InstanceManager from './instanceManager';

import mathHelper from './../math/mathHelper';
import PortalCullingAlgo from './../math/portalCullingAlgo';

import config from './../../services/config'
import { performanceBegin, performanceEnd, PerformanceCategory } from './../../services/performance';

import {mat4} from 'gl-matrix';
import type {ReadonlyMat4, vec4} from 'gl-matrix';
import type { AdtM2Placement } from '../../services/map/adtLoader';
import type { WmoDoodad } from '../../services/map/wmoLoader';
import type { M2Object } from '../objects/M2Object';
import type { WmoPlacement } from '../objects/wmoObject';
import type { SceneApi } from '../sceneApi';


class GraphManager {
    sceneApi: SceneApi;
    m2Objects: (adtM2ObjectFactory | wmoM2ObjectFactory)[];
    worldM2Objects: WorldMDXObject[];
    instanceMap: { [fileIdent: string]: InstanceManager };
    instanceList: InstanceManager[];
    wmoObjects: WmoObject[];
    wmoRenderedThisFrame: WmoObject[];
    uniqueIdM2Map: { [uniqueId: number]: adtM2ObjectFactory };
    uniqueIdWmoMap: { [uniqueId: number]: WmoObject };
    adtObjects: adtObjectFactory[];
    adtRenderedThisFrame: adtObjectFactory[];
    m2RenderedThisFrame: M2Object[];
    /* nothing assigns a sky dome; drawExterior() draws one only if it is set */
    skyDom: { draw(): void } | null;
    currentTime: number;
    lastTimeSort: number;
    lastTimeDistanceCalc: number;
    lastInstanceCollect: number;
    lastFogParamCheck: number;
    globalM2Counter: number;
    portalCullingAlgo: PortalCullingAlgo;
    /* [x][y] of the 64x64 ADT grid */
    adtObjectsMap: adtObjectFactory[][];
    /* set by loadWmoMap() */
    isWmoMap: boolean | undefined;
    wmoMap!: WmoObject;
    /* set by setCameraPos() / setLookAtMat() before update() */
    position!: vec4;
    lookAtMat!: mat4;
    /* set by update() */
    currentInteriorGroup!: number;
    currentWMO!: WmoObject | null;
    /* reset by draw() */
    m2OpaqueRenderedThisFrame!: { [sceneNumber: number]: boolean };
    m2TranspRenderedThisFrame!: { [sceneNumber: number]: boolean };

    constructor(sceneApi: SceneApi) {
        this.sceneApi = sceneApi;
        this.m2Objects = [];
        this.worldM2Objects = [];
        this.instanceMap = {};
        this.instanceList = [];
        this.wmoObjects = [];
        this.wmoRenderedThisFrame = [];

        this.uniqueIdM2Map = {};
        this.uniqueIdWmoMap = {};

        this.adtObjects = [];
        this.adtRenderedThisFrame = [];
        this.m2RenderedThisFrame = []
        this.skyDom = null;

        this.currentTime = 0;
        this.lastTimeSort = 0;
        this.lastTimeDistanceCalc = 0;
        this.lastInstanceCollect = 0;
        this.lastFogParamCheck = 0;

        this.globalM2Counter = 0;
        this.portalCullingAlgo = new PortalCullingAlgo()

        this.adtObjectsMap = new Array(64);
        for (var i = 0; i < 64; i++) {
            var map = new Array(64);
            this.adtObjectsMap[i] = map;
        }
    }

    /*
    * Function for adding a new geometry to scene
    * */
    loadWmoMap(modf: WmoPlacement) {
        this.isWmoMap = true;
        this.wmoMap = this.addWmoObject(modf);
    }
    addAdtM2Object(doodad: AdtM2Placement) {
        if (this.uniqueIdM2Map[doodad.uniqueId]) {
            return this.uniqueIdM2Map[doodad.uniqueId];
        }

        var adtM2 = new adtM2ObjectFactory(this.sceneApi);
        // JS-BUG: AdtM2Object.load takes one argument; the second (false) is ignored - harmless
        // @ts-expect-error load takes one argument; ported as-is
        adtM2.load(doodad, false);
        adtM2.sceneNumber = this.globalM2Counter++;

        this.m2Objects.push(adtM2);
        this.uniqueIdM2Map[doodad.uniqueId] = adtM2;
        return adtM2;
    }
    addWorldMDXObject(modelName: string, meshIds: number[] | null,replaceTextures: string[] | null) {
        var worldMdxObject = new WorldMDXObject(this.sceneApi);
        worldMdxObject.setLoadParams(modelName, 0, meshIds,replaceTextures);
        worldMdxObject.sceneNumber = this.globalM2Counter++;
        worldMdxObject.startLoading();
        worldMdxObject.setIsRendered(true);

        this.worldM2Objects.push(worldMdxObject);
        return worldMdxObject;
    }
    addWmoM2Object(doodadDef: WmoDoodad, placementMatrix: mat4, useLocalLighting: boolean) {
        var wmoM2Object = new wmoM2ObjectFactory(this.sceneApi);
        wmoM2Object.load(doodadDef, placementMatrix, useLocalLighting);

        wmoM2Object.sceneNumber = this.globalM2Counter++;
        this.m2Objects.push(wmoM2Object);

        return wmoM2Object;
    }
    addWmoObject(wmoDef: WmoPlacement) {
        if (this.uniqueIdWmoMap[wmoDef.uniqueId]) {
            return this.uniqueIdWmoMap[wmoDef.uniqueId];
        }

        var wmoObject = new WmoObject(this.sceneApi);
        wmoObject.setLoadingParam(wmoDef);

        this.wmoObjects.push(wmoObject);
        this.uniqueIdWmoMap[wmoDef.uniqueId] = wmoObject;

        return wmoObject;
    }

    addADTObject(x: number, y: number, fileName: string) {
        if (this.adtObjectsMap[x][y]) return;

        var adtObject = new adtObjectFactory(this.sceneApi);
        adtObject.load(fileName);

        this.adtObjectsMap[x][y] = adtObject;

        this.adtObjects.push(adtObject);
    }
    /* no caller passes newBucket */
    addM2ObjectToInstanceManager(m2Object: M2Object, newBucket?: unknown) {
        var fileIdent = m2Object.getFileNameIdent();
        var instanceManager = this.instanceMap[fileIdent];
        //1. Create Instance manager for this type of file if it was not created yet
        if (!instanceManager) {
            instanceManager = new InstanceManager(this.sceneApi);
            this.instanceMap[fileIdent] = instanceManager;
            this.instanceList.push(instanceManager);
        }

        //2. Add object to instance
        // JS-BUG: InstanceManager.addMDXObject takes one argument; newBucket (never passed anyway) is ignored - harmless
        // @ts-expect-error addMDXObject takes one argument; ported as-is
        instanceManager.addMDXObject(m2Object, newBucket);

        //3. Assign instance to object
        m2Object.instanceManager = instanceManager;
    }

    /*
    * Local variables
    * */

    setCameraPos(position: vec4) {
        this.position = position;
    }
    setLookAtMat(lookAtMat: mat4) {
        this.lookAtMat = lookAtMat;
    }

    /*
    * Culling algorithms
    * */
    checkCulling(frustumMat: ReadonlyMat4, lookAtMat4: ReadonlyMat4) {
        var adtRenderedThisFrame = new Set<adtObjectFactory>();
        var m2RenderedThisFrame = new Set<M2Object>();
        var wmoRenderedThisFrame = new Set<WmoObject>();

        if (this.currentInteriorGroup >= 0 && config.getUsePortalCulling()) {
            var combinedMat4 = mat4.create();
            mat4.multiply(combinedMat4, frustumMat, lookAtMat4);
            var frustumPlanes = mathHelper.getFrustumClipsFromMatrix(combinedMat4);
            mathHelper.fixNearPlane(frustumPlanes, this.position);

            //Travel through portals
            if (this.portalCullingAlgo.startTraversingFromInteriorWMO(this.currentWMO!, this.currentInteriorGroup, this.position,
                lookAtMat4, frustumPlanes, m2RenderedThisFrame)) {

                wmoRenderedThisFrame.add(this.currentWMO!);

                if (this.currentWMO!.exteriorPortals.length > 0) {
                    this.checkExterior(frustumPlanes, lookAtMat4, 6,
                        m2RenderedThisFrame, wmoRenderedThisFrame, adtRenderedThisFrame);
                }
            }
        } else {
            /* 1. Extract planes */
            var combinedMat4 = mat4.create();
            mat4.multiply(combinedMat4, frustumMat, lookAtMat4);
            var frustumPlanes = mathHelper.getFrustumClipsFromMatrix(combinedMat4);
            mathHelper.fixNearPlane(frustumPlanes, this.position);

            // JS-BUG: points is computed and never used - harmless
            var points = mathHelper.getFrustumPoints(frustumMat, lookAtMat4);

            //Plain check for exterior
            this.checkExterior(frustumPlanes, lookAtMat4, 6,
                m2RenderedThisFrame, wmoRenderedThisFrame, adtRenderedThisFrame);
        }

        //Add WorldObjects
        for (var i = 0; i < this.worldM2Objects.length; i++) {
            var m2Object = this.worldM2Objects[i];
            // JS-BUG: return, not continue - a missing entry would skip the rest of checkCulling (the rendered lists are not updated); unreachable, worldM2Objects has no holes
            if(!m2Object ) return;

            var frustumResult = true;
            if( m2Object.loaded ) {
                var frustumResult = m2Object.checkFrustumCulling(this.position, frustumPlanes, 6);
            }

            if (frustumResult) {
                m2Object.setIsRendered(true);
                m2RenderedThisFrame.add(m2Object);
            }
        }


        this.adtRenderedThisFrame = Array.from(adtRenderedThisFrame);
        this.m2RenderedThisFrame = Array.from(m2RenderedThisFrame);
        this.wmoRenderedThisFrame = Array.from(wmoRenderedThisFrame);

        for (var i = 0; i < this.m2RenderedThisFrame.length; i++){
            this.m2RenderedThisFrame[i].setIsRendered(true)
        }
    }

    checkExterior(frustumPlanes: vec4[], lookAtMat4: ReadonlyMat4, num_planes: number,
                  m2RenderedThisFrame: Set<M2Object>, wmoRenderedThisFrame: Set<WmoObject>, adtRenderedThisFrame: Set<adtObjectFactory>) {
        var self = this;
        /* 3. Check frustum for graphs */
        var m2ObjectsCandidates = new Set<adtM2ObjectFactory>();
        var wmoCandidates = new Set<WmoObject>();

        if (!this.isWmoMap) {
            //3.1 if this is not WMO map iterate over ADTs
            var adt_x = Math.floor((32 - (this.position[1] / 533.33333)));
            var adt_y = Math.floor((32 - (this.position[0] / 533.33333)));

            for (var i = adt_x-1; i <= adt_x+1; i++) {
                for (var j = adt_y-1; j <= adt_y+1; j++) {
                    if ((i < 0) || (i >= 64)) continue;
                    if ((j < 0) || (j >= 64)) continue;
                    var adtObject = this.adtObjectsMap[i][j];
                    if (adtObject) {
                        var result = adtObject.checkFrustumCulling(this.position, frustumPlanes, lookAtMat4, num_planes, m2ObjectsCandidates, wmoCandidates);
                        if (result) {
                            adtRenderedThisFrame.add(adtObject);
                        }
                    }
                }
            }
        } else {
            wmoCandidates.add(this.wmoMap);
        }

        //3.2 Iterate over all global WMOs and M2s (they have uniqueIds)
        m2ObjectsCandidates.forEach(function(value) {
            var m2Object = value;
            if(!m2Object ) return;

            var frustumResult = m2Object.checkFrustumCulling(self.position, frustumPlanes, num_planes);
            if (frustumResult) {
                m2Object.setIsRendered(true);
                m2RenderedThisFrame.add(m2Object);
            }
        });

        wmoCandidates.forEach(function(value) {
            var wmoObject = value;
            if(!wmoObject) return;
            if(wmoRenderedThisFrame.has(value)) return;
            if (!wmoObject.loaded) {
                wmoRenderedThisFrame.add(wmoObject);
                return
            }

            // Portal culling only runs from inside a WMO (checkCulling); from outside, the groups are
            // checked against the frustum. Traversing from the exterior groups hid WMOs whose open-air
            // parts are interior groups, such as Orgrimmar (2 of its 144 groups are exterior) from above
            if (wmoObject.checkFrustumCulling(self.position, frustumPlanes, num_planes, m2RenderedThisFrame)) {
                wmoRenderedThisFrame.add(wmoObject);
            }
        });

    }

    sortGeometry(frustumMat: ReadonlyMat4, lookAtMat4: ReadonlyMat4) {
        for (var j = 0; j < this.m2RenderedThisFrame.length; j++) {
            this.m2RenderedThisFrame[j].sortMaterials(lookAtMat4);
        }
    }

    /*
     * Update function
     * */
    sortM2 (a: M2Object, b: M2Object) {
        return b.getCurrentDistance() - a.getCurrentDistance() > 0 ? 1 : -1;
    }
    update(deltaTime: number) {
        //1. Update all wmo and m2 objects
        var i: number;

        if (config.getRenderM2()) {
            for (i = 0; i < this.m2RenderedThisFrame.length; i++) {
                this.m2RenderedThisFrame[i].update(deltaTime, this.position, this.lookAtMat);
            }
        }

        for (i = 0; i < this.wmoRenderedThisFrame.length; i++) {
            // JS-BUG: WmoObject.update takes no arguments; deltaTime is ignored - harmless
            // @ts-expect-error update takes no arguments; ported as-is
            this.wmoRenderedThisFrame[i].update(deltaTime);
        }

        //2. Calc distance every 100 ms
        if (this.currentTime + deltaTime - this.lastTimeDistanceCalc > 100) {
            for (var j = 0; j < this.m2RenderedThisFrame.length; j++) {
                //if (this.m2Objects[j].getIsRendered()) {
                this.m2RenderedThisFrame[j].calcDistance(this.position);
                //}
            }

            this.lastTimeDistanceCalc = this.currentTime;
        }

        //3. Sort m2 by distance every 100 ms
        if (this.currentTime + deltaTime - this.lastTimeSort > 100) {
            this.m2RenderedThisFrame.sort(this.sortM2);

            this.lastTimeSort = this.currentTime;
        }

        //4. Collect m2 into instances every 200 ms


//        if (this.currentTime + deltaTime - this.lastInstanceCollect > 30) {
            var map: { [fileIdent: string]: M2Object } = {};
            if (this.sceneApi.extensions.getInstancingExt()) {
                for (var j = 0; j < this.m2RenderedThisFrame.length; j++) {
                    var m2Object = this.m2RenderedThisFrame[j];

                    if (!m2Object.m2Geom) continue;
                    if (m2Object.getHasBillboarded() || !m2Object.getIsInstancable()) continue;
                    if (!m2Object.getIsRendered()) continue;

                    var fileIdent = m2Object.getFileNameIdent();

                    if (map[fileIdent] != undefined) {
                        this.addM2ObjectToInstanceManager(m2Object);
                        if (!map[fileIdent].instanceManager) {
                            this.addM2ObjectToInstanceManager(map[fileIdent]);
                        }
                    } else {
                        map[fileIdent] = m2Object;
                    }
                }
            }

            //4.1 Update placement matrix buffers in Instance
            for (var j = 0; j < this.instanceList.length; j++) {
                var instanceManager = this.instanceList[j];
                instanceManager.updatePlacementVBO();
            }

            this.lastInstanceCollect = this.currentTime;
  //      }


        //5. Check what WMO instance we're in
        this.currentInteriorGroup = -1;
        this.currentWMO = null;
        var bspNodeId = -1;
        var interiorGroupNum = -1;
        for (var i = 0; i < this.wmoObjects.length; i++) {
            var result = this.wmoObjects[i].isInsideInterior(this.position);
            // JS-BUG: isInsideInterior returns -1 (a number) when the camera is outside the WMO's box, so groupId is undefined - works because undefined >= 0 is false, but update() then returns interiorGroupNum undefined (the UI shows `|| 0`)
            // @ts-expect-error isInsideInterior may return -1; ported as-is
            interiorGroupNum = result.groupId;

            if (interiorGroupNum >= 0) {
                this.currentWMO = this.wmoObjects[i];
                this.currentInteriorGroup = interiorGroupNum;
                // @ts-expect-error isInsideInterior may return -1 (not here: groupId >= 0); ported as-is
                bspNodeId = result.nodeId;
                break;
            }
        }

        //6. Check fog color every 2 seconds
        if (this.currentTime + deltaTime - this.lastFogParamCheck > 2000) {
            this.lastFogParamCheck = this.currentTime;
        }

        this.currentTime = this.currentTime + deltaTime;
        return {interiorGroupNum: interiorGroupNum, nodeId: bspNodeId};
    }

    /*
    * Draw functions
    * */

    drawExterior() {
        //1. Draw ADT

        if (config.getRenderAdt()) {
            this.sceneApi.shaders.activateAdtShader();
            for (var i = 0; i < this.adtRenderedThisFrame.length; i++) {
                this.adtRenderedThisFrame[i].draw();
            }
        }


        //2.0. Draw WMO bsp highlighted vertices
        if (config.getRenderBSP()) {
            this.sceneApi.shaders.activateDrawPortalShader();
            for (var i = 0; i < this.wmoRenderedThisFrame.length; i++) {
                this.wmoRenderedThisFrame[i].drawBspVerticles();
            }
        }

        //2. Draw WMO
        if (config.getRenderWMO()) {
          this.sceneApi.shaders.activateWMOShader();
          var t = performanceBegin();
          for (var i = 0; i < this.wmoRenderedThisFrame.length; i++) {
              // only the WMO the camera is inside has been portal traversed (see checkExterior)
              if (config.getUsePortalCulling() && this.wmoRenderedThisFrame[i] === this.currentWMO) {
                  this.wmoRenderedThisFrame[i].drawPortalBased(false)
              } else {
                  this.wmoRenderedThisFrame[i].draw();
              }
          }
          performanceEnd(PerformanceCategory.WMO_RENDER, t);
          this.sceneApi.shaders.deactivateWMOShader();
        }

        //3. Draw background WDL

        //4. Draw skydom
        if (this.skyDom) {
            this.skyDom.draw();
        }

        //7.1 Draw WMO BBs
        this.sceneApi.shaders.activateBoundingBoxShader();
        if (config.getDrawWmoBB()) {
            for (var i = 0; i < this.wmoRenderedThisFrame.length; i++) {
                this.wmoRenderedThisFrame[i].drawBB();
            }
        }

        /*
         this.sceneApi.shaders.activateFrustumBoxShader();
         //Draw Wmo portal frustums
         for (var i = 0; i < this.wmoObjects.length; i++) {
         this.wmoObjects[i].drawPortalFrustumsBB();
         }
         */
    }
    drawM2s(){
        //5. Draw nontransparent meshes of m2
        if (config.getRenderM2()) {
            var lastWasDrawInstanced = false;
            this.sceneApi.shaders.activateM2Shader();
            for (var i = 0; i < this.m2RenderedThisFrame.length; i++) {
                var m2Object = this.m2RenderedThisFrame[i];
                if (this.m2OpaqueRenderedThisFrame[m2Object.sceneNumber]) continue;
                if (!m2Object.getIsRendered()) continue;

                if (m2Object.instanceManager) {
                    if (!lastWasDrawInstanced) {
                        this.sceneApi.shaders.activateM2InstancingShader();
                    }

                    m2Object.instanceManager.drawInstancedNonTransparentMeshes(this.m2OpaqueRenderedThisFrame)
                    lastWasDrawInstanced = true;
                } else {
                    if (lastWasDrawInstanced) {
                        this.sceneApi.shaders.deactivateM2InstancingShader();
                        this.sceneApi.shaders.activateM2Shader();
                    }

                    this.m2OpaqueRenderedThisFrame[m2Object.sceneNumber] = true;
                    m2Object.drawNonTransparentMeshes();
                    lastWasDrawInstanced = false;
                }
            }
            if (lastWasDrawInstanced) {
                this.sceneApi.shaders.deactivateM2InstancingShader();
            } else {
                this.sceneApi.shaders.deactivateM2Shader();
            }
        }

        //6. Draw transparent meshes of m2
        if (config.getRenderM2()) {
            var lastWasDrawInstanced = false;
            this.sceneApi.shaders.activateM2Shader();
            for (var i = this.m2RenderedThisFrame.length-1; i >= 0; i--) {
                var m2Object = this.m2RenderedThisFrame[i];
                if (this.m2TranspRenderedThisFrame[m2Object.sceneNumber]) continue;
                if (!m2Object.getIsRendered()) continue;

                if (m2Object.instanceManager) {
                    if (!lastWasDrawInstanced) {
                        this.sceneApi.shaders.activateM2InstancingShader();
                    }

                    m2Object.instanceManager.drawInstancedTransparentMeshes(this.m2TranspRenderedThisFrame)
                    lastWasDrawInstanced = true;
                } else {
                    if (lastWasDrawInstanced) {
                        this.sceneApi.shaders.deactivateM2InstancingShader();
                        this.sceneApi.shaders.activateM2Shader();
                    }

                    this.m2TranspRenderedThisFrame[m2Object.sceneNumber] = true;
                    m2Object.drawTransparentMeshes();
                    lastWasDrawInstanced = false;
                }
            }
            if (lastWasDrawInstanced) {
                this.sceneApi.shaders.deactivateM2InstancingShader();
            } else {
                this.sceneApi.shaders.deactivateM2Shader();
            }
        }


        //7. Draw BBs
        this.sceneApi.shaders.activateBoundingBoxShader();
        //7.1 Draw M2 BBs
        if (config.getDrawM2BB()) {
            for (var i = 0; i < this.m2RenderedThisFrame.length; i++) {
                if (!this.m2RenderedThisFrame[i].getIsRendered()) continue;

                // JS-BUG: WorldMDXObject does not override drawBB(color), so world M2s pass no color - probably a GL INVALID_VALUE from uniform3fv(uColor, empty array), the box keeps the previous color
                // @ts-expect-error MDXObject.drawBB takes a color; WorldMDXObject does not override it; ported as-is
                this.m2RenderedThisFrame[i].drawBB();
            }
        }
    }
    /* The liquids, after the opaque geometry as water is transparent: the terrain's when the exterior
     * was drawn, and those of the WMO groups drawn this frame */
    drawLiquids(view: ReadonlyMat4, proj: ReadonlyMat4, time: number, exteriorDrawn: boolean) {
        if (!config.getRenderLiquid()) return;

        if (exteriorDrawn) {
            for (var i = 0; i < this.adtRenderedThisFrame.length; i++) {
                this.adtRenderedThisFrame[i].drawLiquids(view, proj, time);
            }
        }
        for (var i = 0; i < this.wmoRenderedThisFrame.length; i++) {
            this.wmoRenderedThisFrame[i].drawLiquids(view, proj, time);
        }
        if (this.currentWMO) {
            this.currentWMO.drawLiquids(view, proj, time);
        }
    }
    /* view / proj and the liquid clock (seconds) are only used by the liquids */
    draw(view: ReadonlyMat4, proj: ReadonlyMat4, liquidTime: number) {
        this.m2OpaqueRenderedThisFrame = {};
        this.m2TranspRenderedThisFrame = {};

        if (this.currentWMO && config.getUsePortalCulling()) {
            this.sceneApi.shaders.activateWMOShader();
            this.currentWMO.drawPortalBased(true);
            this.sceneApi.shaders.deactivateWMOShader();

            if (this.currentWMO.exteriorPortals.length > 0) {
                this.drawExterior()
            }
            //6. Draw WMO portals
            if (config.getRenderPortals()) {
                this.sceneApi.shaders.activateDrawPortalShader();
                for (var i = 0; i < this.wmoRenderedThisFrame.length; i++) {
                    this.wmoRenderedThisFrame[i].drawPortals();
                }
            }
            var t = performanceBegin();
            this.drawM2s();
            performanceEnd(PerformanceCategory.M2_RENDER, t);
            this.drawLiquids(view, proj, liquidTime, this.currentWMO.exteriorPortals.length > 0);

            this.sceneApi.shaders.activateFrustumBoxShader();
            //Draw Wmo portal frustums
            if (this.sceneApi.getIsDebugCamera()) {
                this.sceneApi.drawCamera()
            }
        } else {
            this.drawExterior();
            var t = performanceBegin();
            this.drawM2s();
            performanceEnd(PerformanceCategory.M2_RENDER, t);
            this.drawLiquids(view, proj, liquidTime, true);

            //6. Draw WMO portals
            if (config.getRenderPortals()) {
                this.sceneApi.shaders.activateDrawPortalShader();
                for (var i = 0; i < this.wmoRenderedThisFrame.length; i++) {
                    this.wmoRenderedThisFrame[i].drawPortals();
                }
            }
            this.sceneApi.shaders.activateFrustumBoxShader();
            //Draw Wmo portal frustums
            if (this.sceneApi.getIsDebugCamera()) {
                this.sceneApi.drawCamera()
            }
        }
    }
}

export default GraphManager;
