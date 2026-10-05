import type {ReadonlyMat4, ReadonlyVec4} from 'gl-matrix';
import type MDXObject from './../objects/M2Object';
import type { Texture } from './../texture/textureCache';
import type { SceneApi } from './../sceneApi';

/* One emitter's quads and how to draw them */
interface ParticleBatch {
    texture: Texture;
    blend: number;
    unfogged: boolean;
    depthWrite: boolean;
    wrapX: boolean;
    wrapY: boolean;
    firstQuad: number;
    quadCount: number;
    distance: number;
}

/* position (3), colour (4), uv (2) */
const FLOATS_PER_VERTEX = 9;
const FLOATS_PER_QUAD = FLOATS_PER_VERTEX * 4;
const STRIDE = FLOATS_PER_VERTEX * 4;
/* the quads of one draw, with uint16 indices (WebGL 1); a batch's attributes start at its first vertex */
const MAX_QUADS_PER_DRAW = 16384;

/* Per M2 blend mode, as m2Geom's drawMesh: the alpha test */
function alphaTestFor(blend: number) {
    return blend == 0 ? -1 : blend == 1 ? 0.903921569 : 0.00392157;
}

/* Draws the particles and ribbons of the M2s updated this frame (my_web_wow's ParticleRenderer). tbc drew
 * every quad with immediate mode GL per system; here all quads of a frame go into one stream vertex buffer
 * (position, colour, uv), with a static quad index buffer, and each emitter is a batch with its own
 * texture and blend mode. Blended batches are drawn back to front by emitter distance, after the opaque
 * ones, without depth writes. */
export default class ParticleRenderer {
    sceneApi: SceneApi;
    submitted: MDXObject[];
    batches: ParticleBatch[];
    vertices: Float32Array;
    quadCount: number;
    current: ParticleBatch | null;

    vbo: WebGLBuffer | null;
    ebo: WebGLBuffer | null;

    /* incremented after every draw: an object submits itself once per frame */
    frameId: number;

    constructor(sceneApi: SceneApi) {
        this.sceneApi = sceneApi;
        this.submitted = [];
        this.batches = [];
        this.vertices = new Float32Array(FLOATS_PER_QUAD * 1024);
        this.quadCount = 0;
        this.current = null;

        this.vbo = null;
        this.ebo = null;

        this.frameId = 0;
    }

    /* called from MDXObject.update after its emitters were updated */
    submit(m2Object: MDXObject) {
        if (m2Object.particleSubmitFrame === this.frameId) return;
        m2Object.particleSubmitFrame = this.frameId;
        this.submitted.push(m2Object);
    }

    /* drops this frame's submitted objects without drawing them */
    discard() {
        this.submitted.length = 0;
        this.frameId++;
    }

    beginBatch(texture: Texture, blend: number, unfogged: boolean, depthWrite: boolean, wrapX: boolean, wrapY: boolean, distance: number) {
        this.current = {
            texture: texture,
            blend: blend,
            unfogged: unfogged,
            depthWrite: depthWrite,
            wrapX: wrapX,
            wrapY: wrapY,
            firstQuad: this.quadCount,
            quadCount: 0,
            distance: distance
        };
    }

    endBatch() {
        var batch = this.current;
        if (!batch) return;
        batch.quadCount = this.quadCount - batch.firstQuad;
        if (batch.quadCount > 0) this.batches.push(batch);
        this.current = null;
    }

    /* the float offset of a new quad (the vertex array grows as needed) */
    reserveQuad() {
        var needed = (this.quadCount + 1) * FLOATS_PER_QUAD;
        if (needed > this.vertices.length) {
            var grown = new Float32Array(Math.max(needed, this.vertices.length * 2));
            grown.set(this.vertices);
            this.vertices = grown;
        }
        return this.quadCount++ * FLOATS_PER_QUAD;
    }

    putVertex(o: number, x: number, y: number, z: number, r: number, g: number, b: number, a: number, u: number, v: number) {
        var d = this.vertices;
        d[o] = x; d[o + 1] = y; d[o + 2] = z;
        d[o + 3] = r; d[o + 4] = g; d[o + 5] = b; d[o + 6] = a;
        d[o + 7] = u; d[o + 8] = v;
    }

    /* A particle quad around (cx, cy, cz) with the half axes m0 (texture u) and m1 (texture v, up), showing
     * texture cell 'cell' of a cols x rows grid */
    addParticleQuad(cx: number, cy: number, cz: number, m0x: number, m0y: number, m0z: number, m1x: number, m1y: number, m1z: number,
                    r: number, g: number, b: number, a: number, cell: number, cols: number, rows: number) {
        var du = 1 / cols, dv = 1 / rows;
        var u0 = (cell % cols) * du;
        var v0 = (Math.floor(cell / cols) % rows) * dv;
        // centre -/+ m0, then -/+ m1
        var ax = cx - m0x, ay = cy - m0y, az = cz - m0z;
        var bx = cx + m0x, by = cy + m0y, bz = cz + m0z;
        var o = this.reserveQuad();
        this.putVertex(o, ax + m1x, ay + m1y, az + m1z, r, g, b, a, u0, v0);
        this.putVertex(o + FLOATS_PER_VERTEX, ax - m1x, ay - m1y, az - m1z, r, g, b, a, u0, v0 + dv);
        this.putVertex(o + 2 * FLOATS_PER_VERTEX, bx + m1x, by + m1y, bz + m1z, r, g, b, a, u0 + du, v0);
        this.putVertex(o + 3 * FLOATS_PER_VERTEX, bx - m1x, by - m1y, bz - m1z, r, g, b, a, u0 + du, v0 + dv);
    }

    /* A ribbon quad between two edges (top and bottom), at u0 and u1 along the texture */
    addRibbonQuad(top0X: number, top0Y: number, top0Z: number, bot0X: number, bot0Y: number, bot0Z: number,
                  top1X: number, top1Y: number, top1Z: number, bot1X: number, bot1Y: number, bot1Z: number,
                  u0: number, u1: number, color: ArrayLike<number>) {
        var r = color[0], g = color[1], b = color[2], a = color[3];
        var o = this.reserveQuad();
        this.putVertex(o, top0X, top0Y, top0Z, r, g, b, a, u0, 0);
        this.putVertex(o + FLOATS_PER_VERTEX, bot0X, bot0Y, bot0Z, r, g, b, a, u0, 1);
        this.putVertex(o + 2 * FLOATS_PER_VERTEX, top1X, top1Y, top1Z, r, g, b, a, u1, 0);
        this.putVertex(o + 3 * FLOATS_PER_VERTEX, bot1X, bot1Y, bot1Z, r, g, b, a, u1, 1);
    }

    /* Builds the quads of the submitted objects for this camera and draws them. Called after the M2s and
     * liquids, with the frame's view and projection. */
    draw(cameraPos: ReadonlyVec4, view: ReadonlyMat4, proj: ReadonlyMat4) {
        this.quadCount = 0;
        this.batches.length = 0;

        // the camera's right and up axes in world space (the first two rows of the view matrix)
        var right = [view[0], view[4], view[8]];
        var up = [view[1], view[5], view[9]];

        for (var i = 0; i < this.submitted.length; i++) {
            this.submitted[i].addParticleQuads(this, cameraPos, right, up);
        }
        this.submitted.length = 0;
        this.frameId++;

        if (this.batches.length == 0) return;

        // opaque first, then the blended back to front
        this.batches.sort(function (a, b) {
            var aOpaque = a.blend <= 1, bOpaque = b.blend <= 1;
            if (aOpaque != bOpaque) return aOpaque ? -1 : 1;
            if (a.distance != b.distance) return b.distance - a.distance;
            return a.firstQuad - b.firstQuad;
        });

        this.drawBatches(view, proj);
    }

    ensureBuffers(gl: WebGLRenderingContext) {
        if (this.vbo) return;
        this.vbo = gl.createBuffer();

        var indices = new Uint16Array(MAX_QUADS_PER_DRAW * 6);
        for (var q = 0; q < MAX_QUADS_PER_DRAW; q++) {
            var v = q * 4;
            var i = q * 6;
            indices[i] = v; indices[i + 1] = v + 1; indices[i + 2] = v + 2;
            indices[i + 3] = v + 2; indices[i + 4] = v + 1; indices[i + 5] = v + 3;
        }
        this.ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    setBlend(gl: WebGLRenderingContext, blend: number) {
        switch (blend) {
            case 0:
            case 1:
                gl.disable(gl.BLEND);
                break;
            case 2:
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 3:
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE);
                break;
            case 5:
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.DST_COLOR, gl.ZERO);
                break;
            case 6:
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.DST_COLOR, gl.SRC_COLOR);
                break;
            case 7:
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                break;
            default: // 4: additive
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                break;
        }
    }

    /* per M2 blend mode, as m2Geom's drawMesh: additive blends fade to black, modulating ones to white / grey */
    fogColorFor(blend: number) {
        switch (blend) {
            case 3:
            case 4: return [0, 0, 0];
            case 5: return [1, 1, 1];
            case 6: return [0.5, 0.5, 0.5];
            default: return this.sceneApi.getFogColor();
        }
    }

    drawBatches(view: ReadonlyMat4, proj: ReadonlyMat4) {
        var sceneApi = this.sceneApi;
        var shader = sceneApi.shaders.getParticleShader();
        if (!shader) return;
        var gl = sceneApi.getGlContext();
        this.ensureBuffers(gl);

        // the M2 draws may leave a vertex array object bound, whose state the pointers below would change
        var vaoExt = sceneApi.extensions.getVaoExt();
        if (vaoExt) vaoExt.bindVertexArrayOES(null);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        // a new store every frame (orphaning), so the browser does not wait for last frame's draws
        gl.bufferData(gl.ARRAY_BUFFER, this.vertices.subarray(0, this.quadCount * FLOATS_PER_QUAD), gl.STREAM_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);

        var uniforms = shader.shaderUniforms;
        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(uniforms.uViewMat, false, view);
        gl.uniformMatrix4fv(uniforms.uPMatrix, false, proj);
        gl.uniform1i(uniforms.uTexture, 0);
        gl.uniform1f(uniforms.uFogStart, sceneApi.getFogStart());
        gl.uniform1f(uniforms.uFogEnd, sceneApi.getFogEnd());

        var aPosition = shader.shaderAttributes.aPosition;
        var aColor = shader.shaderAttributes.aColor;
        var aTexCoord = shader.shaderAttributes.aTexCoord;
        gl.enableVertexAttribArray(aPosition);
        gl.enableVertexAttribArray(aColor);
        gl.enableVertexAttribArray(aTexCoord);

        gl.disable(gl.CULL_FACE);
        gl.activeTexture(gl.TEXTURE0);

        for (var i = 0; i < this.batches.length; i++) {
            var batch = this.batches[i];
            if (!batch.texture.texture) continue;

            this.setBlend(gl, batch.blend);
            gl.depthMask(batch.depthWrite);
            gl.uniform3fv(uniforms.uFogColor, this.fogColorFor(batch.blend));
            gl.uniform1f(uniforms.uAlphaTest, alphaTestFor(batch.blend));
            gl.uniform1i(uniforms.uUnFogged, batch.unfogged ? 1 : 0);

            gl.bindTexture(gl.TEXTURE_2D, batch.texture.texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, batch.wrapX ? gl.REPEAT : gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, batch.wrapY ? gl.REPEAT : gl.CLAMP_TO_EDGE);

            for (var first = batch.firstQuad, left = batch.quadCount; left > 0; ) {
                var quads = Math.min(left, MAX_QUADS_PER_DRAW);
                var offset = first * 4 * STRIDE;
                gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, STRIDE, offset);
                gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, STRIDE, offset + 3 * 4);
                gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, STRIDE, offset + 7 * 4);
                gl.drawElements(gl.TRIANGLES, quads * 6, gl.UNSIGNED_SHORT, 0);
                first += quads;
                left -= quads;
            }
        }

        // the other shaders expect only attribute 0 enabled
        if (aPosition != 0) gl.disableVertexAttribArray(aPosition);
        if (aColor != 0) gl.disableVertexAttribArray(aColor);
        if (aTexCoord != 0) gl.disableVertexAttribArray(aTexCoord);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }
}
