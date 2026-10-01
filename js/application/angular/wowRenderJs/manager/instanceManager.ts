
import type { SceneApi } from './../sceneApi';
import type { M2Object } from './../objects/M2Object';

export default class InstanceManager {
    sceneApi: SceneApi;
    mdxObjectList: M2Object[];
    sceneObjNumMap: { [sceneNumber: number]: M2Object };
    lastUpdatedNumber: number;
    previousObjectList: M2Object[];
    /* created by the first updatePlacementVBO() */
    placementVBO: WebGLBuffer | undefined;
    maxAmountWritten!: number;

    constructor(sceneApi: SceneApi) {
        this.sceneApi = sceneApi;
        this.mdxObjectList = [];
        this.sceneObjNumMap = {};
        this.lastUpdatedNumber = 0;
        this.previousObjectList = [];
    }

    addMDXObject(MDXObject: M2Object) {
        if (this.sceneObjNumMap[MDXObject.sceneNumber]) return; // The object has already been added to this manager

        this.sceneObjNumMap[MDXObject.sceneNumber] = MDXObject;
        this.mdxObjectList.push(MDXObject);
    }
    updatePlacementVBO() {
        var gl = this.sceneApi.getGlContext();

        var paramsVbo = this.placementVBO;
        if (!paramsVbo) {
            paramsVbo = gl.createBuffer();
            this.maxAmountWritten = 0;
        }
        var written = 0;
        var permanentBuffer: number[] = [];

        //1. Collect objects
        var newList: M2Object[] = [];
        for (var i = 0; i < this.mdxObjectList.length; i++) {
            var mdxObject = this.mdxObjectList[i];
            if (mdxObject.getIsRendered()) {
                newList.push(mdxObject);
            }
        }

        if (this.previousObjectList) {
            // JS-BUG: an expression statement with no effect - an unfinished reuse of previousObjectList
            newList
        }

        for (var i = 0; i < newList.length; i++) {
            var mdxObject = newList[i];

            var placementMatrix = mdxObject.placementMatrix;
            var diffuseColor = mdxObject.getDiffuseColor();
            for (var j = 0; j < 16; j++) {
                permanentBuffer[written*20+j] = placementMatrix[j];
            }
            for (var j = 0; j < 4; j++) {
                permanentBuffer[written*20+16+j] = diffuseColor[j];
            }

            written++;
        }

        if (written>0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, paramsVbo);
            if (written > this.maxAmountWritten) {
                var typedBuf = new Float32Array(permanentBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, typedBuf, gl.DYNAMIC_DRAW);

                this.maxAmountWritten = written;
            } else {
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(permanentBuffer));
            }
        }
        this.placementVBO = paramsVbo;
        this.lastUpdatedNumber = written;
    }
    drawInstancedNonTransparentMeshes(opaqueMap: { [sceneNumber: number]: boolean }) {
        if (!this.mdxObjectList[0]) return;
        var lastDrawn: M2Object | undefined;
        for (var i = 0; i < this.mdxObjectList.length; i++) {
            opaqueMap[this.mdxObjectList[i].sceneNumber] = true;
            if (this.mdxObjectList[i].getIsRendered()) {
                lastDrawn = this.mdxObjectList[i];
            }
        }

        lastDrawn!.drawInstancedNonTransparentMeshes(this.lastUpdatedNumber, this.placementVBO!);
    }
    drawInstancedTransparentMeshes(transparentMap: { [sceneNumber: number]: boolean }) {
        if (!this.mdxObjectList[0]) return;
        var lastDrawn: M2Object | undefined;
        for (var i = 0; i < this.mdxObjectList.length; i++) {
            transparentMap[this.mdxObjectList[i].sceneNumber] = true;
            if (this.mdxObjectList[i].getIsRendered()) {
                lastDrawn = this.mdxObjectList[i];
            }
        }

        lastDrawn!.drawInstancedTransparentMeshes(this.lastUpdatedNumber, this.placementVBO!);
    }
}
