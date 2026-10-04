import fileLoader from './../../services/fileLoader.js';
import fileReadHelper from './../../services/fileReadHelper.js';

const TILESIZE = 533.33333;
const ZEROPOINT = 32.0 * TILESIZE;

/* The low-res terrain of a map from its WDL: one mesh per ADT tile, drawn in a flat colour behind the scene */
class LowresTerrain {
    constructor(sceneApi, mapBasename) {
        var self = this;
        this.sceneApi = sceneApi;
        // one vertex buffer per ADT tile that has heights
        this.tileVbos = [];
        // the indices are the same for every tile
        this.ebo = null;
        this.indexCnt = 0;
        // set by dispose(): a WDL that finishes loading afterwards is dropped
        this.disposed = false;

        var path = "World/Maps/" + mapBasename + "/" + mapBasename + ".wdl";
        fileLoader(path).then(function success(data) {
            if (self.disposed) return;
            self.load(data);
        }, function error(e) {
            console.log("[WDL] could not load " + path, e);
        });
    }

    /* Parses the MAOF / MARE chunks and builds a vertex buffer per 16x16 tile patch */
    load(data) {
        var reader = fileReadHelper(data);
        var off = { offs: 0 };
        var total = reader.getLength();

        var tileOfs = [];
        var haveOfs = false;

        while (off.offs + 8 <= total) {
            var fourcc = reader.reverseStr(reader.readString(off, 4));
            var chunkSz = reader.readUint32(off);
            var chunkEnd = off.offs + chunkSz;

            if (fourcc == "MAOF" && chunkSz >= 64 * 64 * 4) {
                for (var k = 0; k < 64 * 64; k++)
                    tileOfs[k] = reader.readUint32(off);
                haveOfs = true;
            } else if (fourcc == "MARE" && haveOfs) {
                this.initIndices();

                for (var j = 0; j < 64; j++)
                    for (var i = 0; i < 64; i++) {
                        var ofs = tileOfs[j * 64 + i];
                        if (ofs == 0) continue;

                        // Guard: bounds check before seeking
                        var seekTo = ofs + 8;
                        if (seekTo + (17 * 17 + 16 * 16) * 2 > total) {
                            console.log("[WDL] Tile [" + j + "," + i + "] offset " + ofs + " out of bounds, skipping");
                            continue;
                        }

                        off.offs = seekTo;

                        var highs = reader.readInt16Array(off, 17 * 17);
                        var subs = reader.readInt16Array(off, 16 * 16);

                        var verts = new Float32Array((17 * 17 + 16 * 16) * 3);
                        var v = 0;

                        for (var y = 0; y < 17; y++)
                            for (var x = 0; x < 17; x++) {
                                var vx = (i + x / 16) * TILESIZE;
                                var vy = highs[y * 17 + x];
                                var vz = (j + y / 16) * TILESIZE;
                                verts[v++] = -(vz - ZEROPOINT);
                                verts[v++] = -(vx - ZEROPOINT);
                                verts[v++] = vy;
                            }

                        for (var y = 0; y < 16; y++)
                            for (var x = 0; x < 16; x++) {
                                var vx = (i + (x + 0.5) / 16) * TILESIZE;
                                var vy = subs[y * 16 + x];
                                var vz = (j + (y + 0.5) / 16) * TILESIZE;
                                verts[v++] = -(vz - ZEROPOINT);
                                verts[v++] = -(vx - ZEROPOINT);
                                verts[v++] = vy;
                            }

                        var gl = this.sceneApi.getGlContext();
                        var vbo = gl.createBuffer();
                        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
                        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
                        gl.bindBuffer(gl.ARRAY_BUFFER, null);

                        this.tileVbos.push(vbo);
                    }

                return;
            }

            off.offs = chunkEnd;
        }

        console.log("[WDL] WDL did not contain MARE after MAOF");
    }

    /* Four triangles around the inner vertex of each of the 16x16 cells */
    initIndices() {
        var idx = [];
        var cornerCount = 17 * 17;

        for (var y = 0; y < 16; y++)
            for (var x = 0; x < 16; x++) {
                var i00 = y * 17 + x;
                var i10 = y * 17 + (x + 1);
                var i01 = (y + 1) * 17 + x;
                var i11 = (y + 1) * 17 + (x + 1);
                var m = cornerCount + y * 16 + x;

                idx.push(i00, m, i10);
                idx.push(i10, m, i11);
                idx.push(i11, m, i01);
                idx.push(i01, m, i00);
            }
        this.indexCnt = idx.length;

        var gl = this.sceneApi.getGlContext();
        this.ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    /* Deletes the buffers of every tile and the shared index buffer */
    dispose() {
        var gl = this.sceneApi.getGlContext();
        for (var i = 0; i < this.tileVbos.length; i++)
            gl.deleteBuffer(this.tileVbos[i]);
        if (this.ebo) gl.deleteBuffer(this.ebo);

        this.tileVbos = [];
        this.ebo = null;
        this.indexCnt = 0;
        this.disposed = true;
    }

    drawAll(lookAtMat4, perspectiveMatrix, color) {
        if (this.tileVbos.length == 0) return;

        var gl = this.sceneApi.getGlContext();
        var shader = this.sceneApi.shaders.getLowresTerrainShader();

        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.shaderUniforms.uLookAtMat, false, lookAtMat4);
        gl.uniformMatrix4fv(shader.shaderUniforms.uPMatrix, false, perspectiveMatrix);
        gl.uniform3fv(shader.shaderUniforms.uColor, color);

        var aPosition = shader.shaderAttributes.aPosition;
        gl.enableVertexAttribArray(aPosition);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);

        for (var i = 0; i < this.tileVbos.length; i++) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.tileVbos[i]);
            gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 3 * 4, 0);
            gl.drawElements(gl.TRIANGLES, this.indexCnt, gl.UNSIGNED_SHORT, 0);
        }

        gl.disableVertexAttribArray(aPosition);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
    }
}

export default LowresTerrain;
