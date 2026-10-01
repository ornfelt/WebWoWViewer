import cacheTemplate from './../cache';
import type { Cache } from './../cache';

import {wmoGroupLoader} from './../../services/map/wmoLoader'
import type { WmoBspNode, WmoGroupFile, WmoMaterial } from './../../services/map/wmoLoader';
import type { SceneApi } from './../sceneApi';
import type { Texture } from './../texture/textureCache';

/* appendBuffer() takes plain float arrays and the MOCV byte arrays (whose .buffer it copies) */
type VertexBuffer = ArrayLike<number> & { buffer?: ArrayBufferLike };

class WmoGeom {
    gl: WebGLRenderingContext;
    sceneApi: SceneApi;
    combinedVBO: WebGLBuffer | null;
    indexVBO: WebGLBuffer | null;
    wmoGroupFile: WmoGroupFile;
    /* per render batch, per texture unit; a slot stays empty until its texture has loaded */
    textureArray: Texture[][];
    momt!: WmoMaterial[];
    positionOffset!: number;
    normalOffset!: number;
    textOffset!: number;
    textOffset2!: number;
    colorOffset!: number;
    colorOffset2!: number;
    mobrVBO!: WebGLBuffer;

    constructor (wmoGroupFile: WmoGroupFile, sceneApi: SceneApi) {
        this.gl = sceneApi.getGlContext();
        this.sceneApi = sceneApi;

        this.combinedVBO = null;
        this.indexVBO = null;
        this.wmoGroupFile = wmoGroupFile;

        this.textureArray = [];
    }
    loadTextures (momt: WmoMaterial[]){
        this.momt = momt;
        this.textureArray.length = this.wmoGroupFile.renderBatches.length;

        for (var i = 0; i < this.wmoGroupFile.renderBatches.length ; i++){
            var textIndex: number;
            var renderBatch = this.wmoGroupFile.renderBatches[i];
            if ((renderBatch.flags & 0x2) > 0) {
                textIndex = renderBatch.unk[11]*256+renderBatch.unk[10]
            } else {
                textIndex = renderBatch.tex;
            }

            this.loadTexture(i, 0, momt[textIndex].textureName1);
            this.loadTexture(i, 1, momt[textIndex].textureName2);
        }
    }
    loadTexture(index: number, textUnit: number, filename: string){
        var self = this;
        if(!filename) return;

        this.sceneApi.resources.loadTexture(filename).then(function success(textObject){
            if (!self.textureArray[index]) {
                self.textureArray[index] = [];
            }
            self.textureArray[index][textUnit] = textObject;
        }, function error(){
        });
    };

    createVBO(){
        var gl = this.gl;
        var wmoGroupObject = this.wmoGroupFile;

        var appendBuffer = function(buffer1: VertexBuffer, buffer2: VertexBuffer, buffer3: VertexBuffer, buffer4: VertexBuffer | undefined,
                                    buffer5: VertexBuffer | undefined, buffer6: VertexBuffer | undefined) {
            var combinedBufferLen = buffer1.length*4 + buffer2.length*4 + buffer3.length*4 ;
            if (buffer4) {
                combinedBufferLen += buffer4.length * 4;
            }
            if (buffer5) {
                combinedBufferLen += buffer5.length* 4;
            }
            if (buffer6) {
                combinedBufferLen += buffer6.length* 4;
            }

            var nextOffset = 0;
            var tmp = new Uint8Array(combinedBufferLen);
            tmp.set(new Uint8Array(new Float32Array(buffer1).buffer), 0);           nextOffset = nextOffset+ buffer1.length*4;
            tmp.set(new Uint8Array(new Float32Array(buffer2).buffer), nextOffset);  nextOffset = nextOffset+ buffer2.length*4;
            tmp.set(new Uint8Array(new Float32Array(buffer3).buffer), nextOffset);  nextOffset = nextOffset+ buffer3.length*4;

            if (buffer4) {
                tmp.set(new Uint8Array(new Float32Array(buffer4).buffer), nextOffset); nextOffset = nextOffset+buffer4.length*4;
            }
            if (buffer5 && buffer5.buffer ) {
                tmp.set(new Uint8Array(buffer5.buffer), nextOffset); nextOffset = nextOffset + buffer5.length*4;
            }
            if (buffer6 && buffer6.buffer) {
                tmp.set(new Uint8Array(buffer6.buffer), nextOffset); nextOffset = nextOffset + buffer6.length*4;
            }

            return tmp;
        };

        var combinedArray =
            appendBuffer(
                wmoGroupObject.verticles,
                wmoGroupObject.normals,
                wmoGroupObject.textCoords,
                wmoGroupObject.textCoords2,
                wmoGroupObject.colorVerticles,
                wmoGroupObject.colorVerticles2
            );

        this.combinedVBO = gl.createBuffer();
        gl.bindBuffer( gl.ARRAY_BUFFER, this.combinedVBO);
        gl.bufferData( gl.ARRAY_BUFFER, combinedArray, gl.STATIC_DRAW );

        this.positionOffset = 0;
        this.normalOffset = this.positionOffset + wmoGroupObject.verticles.length;
        this.textOffset = this.normalOffset + wmoGroupObject.normals.length;
        this.textOffset2 = this.textOffset + wmoGroupObject.textCoords.length;
        this.colorOffset = this.textOffset2 + wmoGroupObject.textCoords2.length;
        // appendBuffer advances 4 bytes per element of colorVerticles (Uint8Array), so the second color set starts colorVerticles.length units after colorOffset
        this.colorOffset2 = this.colorOffset  + ((wmoGroupObject.colorVerticles && wmoGroupObject.colorVerticles.length > 0 )? (wmoGroupObject.colorVerticles.length) : 0);

        this.indexVBO = gl.createBuffer();
        gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.indexVBO );
        gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Int16Array(wmoGroupObject.indicies), gl.STATIC_DRAW );

        if (wmoGroupObject.mobr) {
            this.mobrVBO = gl.createBuffer();
            gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.mobrVBO);
            var bpsIndicies: number[] = new Array(wmoGroupObject.mobr.length*3);
            for (var i = 0; i < wmoGroupObject.mobr.length; i++) {
                bpsIndicies[i*3 + 0] = wmoGroupObject.indicies[3*wmoGroupObject.mobr[i]+0];
                bpsIndicies[i*3 + 1] = wmoGroupObject.indicies[3*wmoGroupObject.mobr[i]+1];
                bpsIndicies[i*3 + 2] = wmoGroupObject.indicies[3*wmoGroupObject.mobr[i]+2];
            }

            gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, new Int16Array(bpsIndicies), gl.STATIC_DRAW);
            gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, null);
        }
    };

    draw (ambientColor?: number[], bspNodeList?: WmoBspNode[] | null){
        var gl = this.gl;
        if (!this.momt) {
            // JS-BUG: loadTextures() without momt throws a TypeError on momt[textIndex]; unreachable today (WmoGroupObject calls loadTextures(momt) before the first draw)
            // @ts-expect-error loadTextures takes the momt array; ported as-is
            this.loadTextures()
        }

        var shaderUniforms = this.sceneApi.shaders.getShaderUniforms();
        var shaderAttributes = this.sceneApi.shaders.getShaderAttributes();

        var blackPixelText = this.sceneApi.getBlackPixelTexture();

        var wmoGroupObject = this.wmoGroupFile;
        var isIndoor = (wmoGroupObject.mogp.Flags & 0x2000) > 0;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexVBO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.combinedVBO);

        gl.enableVertexAttribArray(shaderAttributes.aPosition);
        gl.vertexAttribPointer(shaderAttributes.aPosition, 3, gl.FLOAT, false, 0, 0); // position
        if (shaderAttributes.aNormal != null) {
            gl.vertexAttribPointer(shaderAttributes.aNormal, 3, gl.FLOAT, false, 0, this.normalOffset*4); // normal
        }
        gl.vertexAttribPointer(shaderAttributes.aTexCoord, 2, gl.FLOAT, false, 0, this.textOffset*4); // texcoord


        if (shaderAttributes.aTexCoord2 != null) {
            if ((wmoGroupObject.textCoords2) && (wmoGroupObject.textCoords2.length > 0)) {
                gl.enableVertexAttribArray(shaderAttributes.aTexCoord2);
                gl.vertexAttribPointer(shaderAttributes.aTexCoord2, 2, gl.FLOAT, false, 0, this.textOffset2 * 4); // texcoord
            } else {
                gl.disableVertexAttribArray(shaderAttributes.aTexCoord2);
                gl.vertexAttrib2f(shaderAttributes.aTexCoord2, 1.0, 1.0);
            }
        }

        if (shaderAttributes.aColor != null) {
            if (isIndoor && (wmoGroupObject.colorVerticles) &&(wmoGroupObject.colorVerticles.length > 1)) {
                gl.enableVertexAttribArray(shaderAttributes.aColor);
                gl.vertexAttribPointer(shaderAttributes.aColor, 4, gl.UNSIGNED_BYTE, true, 0, this.colorOffset * 4); // color
            } else {
                gl.disableVertexAttribArray(shaderAttributes.aColor);
                gl.vertexAttrib4f(shaderAttributes.aColor, 1.0, 1.0, 1.0, 1.0);
            }
        }


        //Color2 array
        if (shaderAttributes.aColor2 != null) {
            if (isIndoor && (wmoGroupObject.colorVerticles2) &&(wmoGroupObject.colorVerticles2.length > 0)) {
                gl.enableVertexAttribArray(shaderAttributes.aColor2);
                gl.vertexAttribPointer(shaderAttributes.aColor2, 4, gl.UNSIGNED_BYTE, true, 0, this.colorOffset2 * 4); // color
            } else {
                gl.disableVertexAttribArray(shaderAttributes.aColor2);
                gl.vertexAttrib4f(shaderAttributes.aColor2, 1.0, 1.0, 1.0, 1.0);
            }
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1f(shaderUniforms.uAlphaTest, -1.0);

        //for (var j = 0; j < wmoGroupObject.mogp.numBatchesA; j++) {
        for (var j = 0; j < wmoGroupObject.renderBatches.length; j++) {
            var renderBatch = wmoGroupObject.renderBatches[j];

            var texIndex: number;
            if ((renderBatch.flags & 0x2) > 0) {
                texIndex = renderBatch.unk[11]*256+renderBatch.unk[10];
            } else {
                texIndex = renderBatch.tex;
            }



            var color = this.momt[texIndex].color1;
            var colorVector = [color&0xff, (color>> 8)&0xff,
                (color>>16)&0xff, (color>> 24)&0xff];
            colorVector[0] /= 255.0; colorVector[1] /= 255.0;
            colorVector[2] /= 255.0; colorVector[3] /= 255.0;

            ambientColor = [1,1,1,1];
            gl.uniform4fv(shaderUniforms.uMeshColor1, new Float32Array(ambientColor));


            if (this.momt[texIndex].blendMode != 0) {
                var alphaTestVal = 0.878431;
                if ((this.momt[texIndex].flags1 & 0x80) > 0) {
                    //alphaTestVal = 0.2999999;
                }
                if ((this.momt[texIndex].flags1 & 0x01) > 0) {
                    alphaTestVal = 0.1; //TODO: confirm this
                }

                gl.uniform1f(shaderUniforms.uAlphaTest, alphaTestVal);
            } else {
                gl.uniform1f(shaderUniforms.uAlphaTest, -1.0);
            }

            if ((this.momt[texIndex].flags1 & 0x4) > 0) {
                gl.disable(gl.CULL_FACE);
            } else {
                gl.enable(gl.CULL_FACE);
            }
            var textureObject = this.textureArray[j];

            gl.activeTexture(gl.TEXTURE0);
            if (textureObject && textureObject[0]) {
                gl.bindTexture(gl.TEXTURE_2D, textureObject[0].texture);
            }  else {
                gl.bindTexture(gl.TEXTURE_2D, blackPixelText);
            }
            if (textureObject && textureObject[1]) {
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, textureObject[1].texture);
            } else {
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, blackPixelText);
            }

            /* Hack to skip verticles from node */
            if (bspNodeList) {
                var currentTriangle = renderBatch.startIndex / 3;
                var triangleCount = renderBatch.count / 3;
                var finalTriangle = currentTriangle+triangleCount;

                var mobrPiece: number[] = [];
                for (var k = 0; k < bspNodeList.length; k++) {
                    mobrPiece = mobrPiece.concat(this.wmoGroupFile.mobr.slice(bspNodeList[k].firstFace, bspNodeList[k].firstFace+bspNodeList[k].numFaces-1));
                }
                mobrPiece = mobrPiece.sort(function (a,b) {return a < b ? -1 : 1}).filter(function(item, pos, ary) {
                    return !pos || item != ary[pos - 1];
                });

                var mobrIndex = 0;
                while (currentTriangle < finalTriangle) {
                    while (mobrPiece[mobrIndex] < currentTriangle) mobrIndex++;
                    while (currentTriangle == mobrPiece[mobrIndex]) {currentTriangle++; mobrIndex++};

                    triangleCount = finalTriangle - currentTriangle;
                    if (currentTriangle < mobrPiece[mobrIndex] && (currentTriangle + triangleCount > mobrPiece[mobrIndex])) {
                        triangleCount = mobrPiece[mobrIndex] - currentTriangle;
                    }

                    gl.drawElements(gl.TRIANGLES, triangleCount*3, gl.UNSIGNED_SHORT, currentTriangle*3 * 2);
                    currentTriangle = currentTriangle + triangleCount;
                }
            } else {
                gl.drawElements(gl.TRIANGLES, renderBatch.count, gl.UNSIGNED_SHORT, renderBatch.startIndex * 2);
            }

            if (textureObject && textureObject[1]) {
                gl.activeTexture(gl.TEXTURE1);
                gl.bindTexture(gl.TEXTURE_2D, null);
                gl.activeTexture(gl.TEXTURE0);
            }
        }
        gl.uniform1f(shaderUniforms.uAlphaTest, -1.0);
    };

    destroy() {
        var gl = this.gl;
        if (this.combinedVBO) {
            gl.deleteBuffer(this.combinedVBO);
        }
        if (this.indexVBO) {
            gl.deleteBuffer(this.indexVBO);
        }
        if (this.mobrVBO) {
            gl.deleteBuffer(this.mobrVBO);
        }

        this.combinedVBO = null;
        this.indexVBO = null;
    }
}


class WmoGeomCache {
    cache: Cache<WmoGeom, WmoGroupFile>;

    constructor (sceneApi: SceneApi) {
        this.cache = cacheTemplate(function loadGroupWmo(fileName: string) {
            /* Must return promise */
            return wmoGroupLoader(fileName, true);
        }, function process(wmoGroupFile: WmoGroupFile) {

            var wmoGeomObj = new WmoGeom(wmoGroupFile, sceneApi);
            wmoGeomObj.createVBO();
            return wmoGeomObj;
        });
    }
    loadWmoGeom (fileName: string){
        return this.cache.get(fileName);
    };
    unLoadWmoGeom (fileName: string) {
        this.cache.remove(fileName)
    }
}

export type { WmoGeom };

export default WmoGeomCache;