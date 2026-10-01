import {vec3} from 'gl-matrix'

const TILESIZE = 533.33333;
const CHUNKSIZE = TILESIZE / 16.0;
const ZEROPOINT = 32.0 * TILESIZE;

/* The liquid surface (water, magma) of one MCNK, read from its MCLQ chunk.
 * The GPU buffers and the textures are created on the first draw. */
class Liquid {
    // init
    constructor(x, y, basePos, tilesize = CHUNKSIZE / 8.0) {
        this.xtiles = x;
        this.ytiles = y;
        this.pos = vec3.clone(basePos);
        this.tilesize = tilesize;
        this.ydir = 1.0;

        this.texRepeats = 0;
        this.type = 0;
        this.transparent = false;

        this.vbo = null;
        this.ebo = null;
        this.indexCnt = 0;

        this.textures = [];
        this.liquidTextureFirst = 0;
        this.liquidTextureLast = 0;

        this.pendingHeights = null;
        this.pendingTileFlags = null;
    }

    // public entry points

    initFromTerrain(br, off, flags) {
        this.texRepeats = 4.0;
        this.ydir = 1.0;

        if ((flags & 16) != 0) {
            this.liquidTextureBaseName = "XTextures\\lava\\lava";
            this.liquidTextureFirst    = 1;
            this.liquidTextureLast     = 30;
            this.type = 0;
        } else if ((flags & 4) != 0) {
            this.liquidTextureBaseName = "XTextures\\river\\lake_a";
            this.liquidTextureFirst    = 1;
            this.liquidTextureLast     = 30;
            this.type = 2;
        } else if ((flags & 32) != 0) {
            this.liquidTextureBaseName = "XTextures\\slime\\slime";
            this.liquidTextureFirst    = 1;
            this.liquidTextureLast     = 30;
            this.type = 0;
        } else {
            this.liquidTextureBaseName = "XTextures\\ocean\\ocean_h";
            this.liquidTextureFirst    = 1;
            this.liquidTextureLast     = 30;
            this.type = 2;
        }

        var vCount  = (this.xtiles + 1) * (this.ytiles + 1);
        var heights = new Array(vCount);
        var colors  = new Uint8Array(vCount * 4);

        for (var v = 0; v < vCount; v++) {
            colors[v * 4 + 0] = br.readUint8(off);
            colors[v * 4 + 1] = br.readUint8(off);
            colors[v * 4 + 2] = br.readUint8(off);
            colors[v * 4 + 3] = br.readUint8(off);
            heights[v]        = br.readFloat32(off);
        }

        var tileFlags = br.readUint8Array(off, this.xtiles * this.ytiles);

        this.pendingHeights   = heights;
        this.pendingTileFlags = tileFlags;
        // the GPU buffers stay unset until the first draw
    }

    // Draw
    draw(sceneApi, viewProj, worldTime, waterTint) {
        if (!this.ensureGpuBuffers(sceneApi)) return;
        if (!this.ensureTextures(sceneApi))   return;

        var gl = sceneApi.getGlContext();

        var tex = this.textures[Math.floor(worldTime * 30) % this.textures.length];
        // TODO: don't force this
        this.transparent = false;

        if (this.transparent) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
        }

        var shader = sceneApi.shaders.getLiquidShader();
        gl.useProgram(shader.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);

        // layout: vec3 pos + vec2 uv
        var aPos = shader.shaderAttributes.aPos;
        var aUV = shader.shaderAttributes.aUV;
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 5 * 4, 0);
        gl.enableVertexAttribArray(aUV);
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 5 * 4, 3 * 4);

        gl.uniformMatrix4fv(shader.shaderUniforms.uVP, false, viewProj);
        gl.uniform1i(shader.shaderUniforms.uTex, 0);
        gl.uniform3fv(shader.shaderUniforms.uTint, waterTint);
        gl.uniform1f(shader.shaderUniforms.uTime, worldTime);
        // GLSL ES 1.00 has no uniform initializers, so the default of uWaveAmp is set here
        gl.uniform1f(shader.shaderUniforms.uWaveAmp, 0.08);
        gl.uniform1f(shader.shaderUniforms.uAlpha, 1.0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex.texture);
        gl.drawElements(gl.TRIANGLES, this.indexCnt, gl.UNSIGNED_SHORT, 0);

        // attribute 0 stays enabled: the scene enables it for the shaders drawn after this one
        if (aPos != 0) gl.disableVertexAttribArray(aPos);
        if (aUV != 0) gl.disableVertexAttribArray(aUV);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);

        if (this.transparent) {
            gl.depthMask(true);
            gl.disable(gl.BLEND);
        }
    }

    // lazy GPU / texture helpers

    /* Returns true when GPU buffers are ready. */
    ensureGpuBuffers(sceneApi) {
        if (this.vbo) return true;                      // already uploaded

        if (this.pendingHeights == null) return false;  // no data yet
        this.buildBuffers(sceneApi, this.pendingHeights, this.pendingTileFlags);
        this.pendingHeights   = null;                   // release CPU memory
        this.pendingTileFlags = null;

        return true;
    }

    /* Returns true when textures are ready. */
    ensureTextures(sceneApi) {
        if (this.textures.length > 0) return true;

        if (!this.liquidTextureBaseName) return false;

        if (!this.texturePromise) {
            this.texturePromise = this.loadTextures(sceneApi,
                this.liquidTextureBaseName, this.liquidTextureFirst, this.liquidTextureLast);
        }

        return false;
    }

    // GPU buffer builders

    buildBuffers(sceneApi, heights, tileFlags) {
        var verts = [];
        var idx   = [];

        for (var j = 0; j <= this.ytiles; j++)
        for (var i = 0; i <= this.xtiles; i++) {
            var p = j * (this.xtiles + 1) + i;
            var h = heights[p];
            if (h > 100000) h = this.pos[1];

            var nx = -(this.pos[2] + this.tilesize * j - ZEROPOINT);
            var ny = -(this.pos[0] + this.tilesize * i - ZEROPOINT);
            var nz = h;

            verts.push(nx, ny, nz, i / this.texRepeats, j / this.texRepeats);
        }

        for (var j = 0; j < this.ytiles; j++)
        for (var i = 0; i < this.xtiles; i++) {
            if ((tileFlags[j * this.xtiles + i] & 8) != 0) continue;

            var p     = j * (this.xtiles + 1) + i;
            var pR    = p + 1;
            var pD    = p + (this.xtiles + 1);
            var pDiag = pD + 1;

            idx.push(p, pR, pDiag, p, pDiag, pD);
        }

        this.uploadBuffers(sceneApi, verts, idx);
        this.transparent = (this.type != 0);
    }

    uploadBuffers(sceneApi, verts, indices) {
        var gl = sceneApi.getGlContext();
        this.indexCnt = indices.length;

        this.vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

        this.ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // texture loading

    loadTextures(sceneApi, basename, first, last) {
        var self = this;
        var promises = [];

        for (var i = first; i <= last; i++) {
            promises.push(sceneApi.resources.loadTexture(basename + "." + i + ".blp"));
        }

        return Promise.all(promises).then(function success(loaded) {
            self.textures = loaded;
        });
    }
}

export default Liquid;
