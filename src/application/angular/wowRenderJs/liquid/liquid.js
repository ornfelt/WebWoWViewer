import {vec3} from 'gl-matrix'
import config from './../../services/config.js';
import { triangleListToLines } from '../geometry/wireframe.js';

const TILESIZE = 533.33333;
const CHUNKSIZE = TILESIZE / 16.0;
const ZEROPOINT = 32.0 * TILESIZE;

/* the colour the shader adds to the water textures */
export const waterTint = [0.10915033, 0.21372549, 0.34509805];
const noTint = [0, 0, 0];

/* LiquidType.dbc liquid classes */
const LIQUID_CLASS_OCEAN = 1;
const LIQUID_CLASS_MAGMA = 2;
const LIQUID_CLASS_SLIME = 3;

/* Water and ocean alpha at depth 0 (shallow) and 1 (deep): the medians of the LightParams.dbc rows,
 * which agree across Classic, TBC and WotLK (the light of the camera's zone is not looked up) */
const WATER_SHALLOW_ALPHA = 0.5;
const WATER_DEEP_ALPHA    = 1.0;
const OCEAN_SHALLOW_ALPHA = 0.75;
const OCEAN_DEEP_ALPHA    = 1.0;
/* MLIQ has no depth: WMO water gets the middle of the shallow / deep range */
const WMO_LIQUID_DEPTH = 0.5;

/* A liquid surface (water, ocean, magma, slime): one layer of an MCNK's MCLQ chunk, one MH2O
 * instance of an MCNK, or the MLIQ chunk of a WMO group (in the WMO's local coordinates).
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
        this.ocean = false;
        this.wmo = false;
        this.col = vec3.create();
        this.liquidTypeId = 0;

        this.vbo = null;
        this.ebo = null;
        this.lineEbo = null;
        this.indexCnt = 0;

        this.textures = [];
        this.liquidTextureFirst = 0;
        this.liquidTextureLast = 0;

        this.pendingHeights = null;
        this.pendingDepths = null;
        this.pendingTileFlags = null;
    }

    // public entry points

    initFromTerrain(br, off, flags) {
        this.texRepeats = 4.0;
        this.ydir = 1.0;

        if ((flags & 16) != 0) {
            this.liquidTexturePattern = "XTextures\\lava\\lava.%d.blp";
            this.liquidTextureFirst    = 1;
            this.liquidTextureLast     = 30;
            this.type = 0;
        } else if ((flags & 4) != 0) {
            this.liquidTexturePattern = "XTextures\\river\\lake_a.%d.blp";
            this.liquidTextureFirst    = 1;
            this.liquidTextureLast     = 30;
            this.type = 2;
        } else if ((flags & 32) != 0) {
            this.liquidTexturePattern = "XTextures\\slime\\slime.%d.blp";
            this.liquidTextureFirst    = 1;
            this.liquidTextureLast     = 30;
            this.type = 0;
        } else {
            this.liquidTexturePattern = "XTextures\\ocean\\ocean_h.%d.blp";
            this.liquidTextureFirst    = 1;
            this.liquidTextureLast     = 30;
            this.type = 2;
            this.ocean = true;
        }

        var vCount  = (this.xtiles + 1) * (this.ytiles + 1);
        var heights = new Array(vCount);
        var depths = new Array(vCount);
        var colors  = new Uint8Array(vCount * 4);

        for (var v = 0; v < vCount; v++) {
            colors[v * 4 + 0] = br.readUint8(off);
            colors[v * 4 + 1] = br.readUint8(off);
            colors[v * 4 + 2] = br.readUint8(off);
            colors[v * 4 + 3] = br.readUint8(off);
            heights[v]        = br.readFloat32(off);
            // water and ocean vertices start with their depth (magma ones with texture coordinates)
            depths[v]         = colors[v * 4 + 0] / 255.0;
        }

        var tileFlags = br.readUint8Array(off, this.xtiles * this.ytiles);

        this.pendingHeights   = heights;
        this.pendingDepths    = depths;
        this.pendingTileFlags = tileFlags;
        // the GPU buffers stay unset until the first draw
    }

    /* One MH2O instance (WotLK): width x height tiles from (xOffset, yOffset) of the MCNK; br reads the MH2O chunk data */
    initFromMH2O(br, inst) {
        this.texRepeats = 4.0;
        this.ydir = 1.0;
        // textures and type from LiquidType.dbc on the first draw
        this.liquidTypeId = inst.liquidType;

        var vCount  = (this.xtiles + 1) * (this.ytiles + 1);
        var heights = new Array(vCount);
        var depths = new Array(vCount);

        // vertex formats 0, 1 and 3 start with a height per vertex; format 2 (depth only) and
        // instances without vertex data are flat at the min height
        if (inst.ofsVertexData != 0 && inst.vertexFormat != 2) {
            var off = {offs: inst.ofsVertexData};
            for (var v = 0; v < vCount; v++) heights[v] = br.readFloat32(off);
        } else {
            for (var v = 0; v < vCount; v++) heights[v] = inst.minHeight;
        }

        // a depth byte per vertex: after the heights (format 0), after the heights and the texture
        // coordinates (format 3) or alone (format 2); without one (format 1, no vertex data: open sea) deep
        var depthOffs = -1;
        if (inst.ofsVertexData != 0) {
            if (inst.vertexFormat == 0) depthOffs = inst.ofsVertexData + vCount * 4;
            else if (inst.vertexFormat == 2) depthOffs = inst.ofsVertexData;
            else if (inst.vertexFormat == 3) depthOffs = inst.ofsVertexData + vCount * 8;
        }
        if (depthOffs >= 0) {
            var depthBytes = br.readUint8Array({offs: depthOffs}, vCount);
            for (var v = 0; v < vCount; v++) depths[v] = depthBytes[v] / 255.0;
        } else {
            for (var v = 0; v < vCount; v++) depths[v] = 1.0;
        }

        // one bit per tile, row by row, low bit first; no bitmap means every tile has liquid
        var tileFlags = new Uint8Array(this.xtiles * this.ytiles);
        if (inst.ofsExistsBitmap != 0) {
            var bits = br.readUint8Array({offs: inst.ofsExistsBitmap}, (tileFlags.length + 7) >> 3);
            for (var t = 0; t < tileFlags.length; t++) {
                if (((bits[t >> 3] >> (t & 7)) & 1) == 0) tileFlags[t] = 8;     // hidden tile
            }
        }

        this.pendingHeights   = heights;
        this.pendingDepths    = depths;
        this.pendingTileFlags = tileFlags;
    }

    /* The MLIQ liquid of a WMO group, as my_wow tbc's Liquid.InitFromWMO: magma / slime / water from
     * the tile flags, indoor water coloured by the WMO material (color2). On WotLK a liquid type id
     * from the group header picks the textures and the type from LiquidType.dbc instead. */
    initFromWmo(heights, tileFlags, materialColor, indoor, liquidTypeId) {
        this.texRepeats = 4.0;
        this.ydir = -1.0;
        this.wmo = true;

        this.pendingHeights   = heights;
        this.pendingTileFlags = tileFlags;
        var depths = new Array(heights.length);
        for (var v = 0; v < depths.length; v++) depths[v] = WMO_LIQUID_DEPTH;
        this.pendingDepths    = depths;

        this.col = vec3.fromValues(((materialColor & 0xFF0000) >> 16) / 255.0, ((materialColor & 0xFF00) >> 8) / 255.0, (materialColor & 0xFF) / 255.0);

        if (liquidTypeId != 0) {
            this.liquidTypeId = liquidTypeId;
            return;
        }

        // tmpflag is the flags value for the last drawn tile
        var tmpflag = 0;
        for (var t = 0; t < tileFlags.length; t++) {
            if ((tileFlags[t] & 8) == 0) tmpflag = tileFlags[t];
        }

        if ((tmpflag & 1) != 0) {
            this.liquidTexturePattern = "XTextures\\slime\\slime.%d.blp";
            this.liquidTextureFirst = 1;
            this.liquidTextureLast  = 30;
            this.type = 0;
            this.texRepeats = 2.0;
        } else if ((tmpflag & 2) != 0) {
            this.liquidTexturePattern = "XTextures\\lava\\lava.%d.blp";
            this.liquidTextureFirst = 1;
            this.liquidTextureLast  = 30;
            this.type = 0;
        } else {
            this.liquidTexturePattern = "XTextures\\river\\lake_a.%d.blp";
            this.liquidTextureFirst = 1;
            this.liquidTextureLast  = 30;
            if (indoor) {
                this.type = 1;
            } else {
                this.type = 2; // outdoor water
            }
        }
    }

    /* Textures and type from a LiquidType.dbc record: magma and slime are not coloured, water and ocean
     * get the water colour. Indoor WMO water is not coloured by the material as in the tbc tile path:
     * the color2 of WotLK WMO materials is no liquid colour (white in Daggercap Cave) */
    initFromLiquidType(liquidType) {
        // an unknown id draws as plain water
        var texture = liquidType ? liquidType.texture : "XTextures\\river\\lake_a.%d.blp";
        var liquidClass = liquidType ? liquidType.type : 0;

        this.liquidTexturePattern = texture;
        this.liquidTextureFirst = 1;
        this.liquidTextureLast  = texture.indexOf("%d") >= 0 ? 30 : 1;

        if (liquidClass == LIQUID_CLASS_MAGMA || liquidClass == LIQUID_CLASS_SLIME) {
            this.type = 0;
        } else {
            this.type = 2;
            this.ocean = (liquidClass == LIQUID_CLASS_OCEAN);
        }
    }

    /* The colour the shader adds to the texture */
    tintFor(waterColor) {
        if (this.type == 0) return noTint;      // not coloured: nothing is added to the texture
        if (this.type == 1) return this.col;
        return waterColor;
    }

    // Draw
    draw(sceneApi, viewProj, worldTime, waterTint) {
        if (!this.ensureGpuBuffers(sceneApi)) return;
        if (!this.ensureTextures(sceneApi))   return;

        var gl = sceneApi.getGlContext();

        var tex = this.textures[Math.floor(worldTime * 30) % this.textures.length];
        // water and ocean are transparent, magma and slime opaque (the type is known once the textures are)
        this.transparent = (this.type != 0);

        // The M2 and WMO materials drawn before leave face culling, blending and depth writes as their last
        // mesh needed them, so set all three: both faces (the terrain liquid triangles are clockwise seen
        // from above, back faces under culling), blending only for the transparent water
        gl.disable(gl.CULL_FACE);
        if (this.transparent) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
        } else {
            gl.disable(gl.BLEND);
            gl.depthMask(true);
        }

        var shader = sceneApi.shaders.getLiquidShader();
        gl.useProgram(shader.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);

        // layout: vec3 pos + vec2 uv + float depth
        var aPos = shader.shaderAttributes.aPos;
        var aUV = shader.shaderAttributes.aUV;
        var aDepth = shader.shaderAttributes.aDepth;
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 6 * 4, 0);
        gl.enableVertexAttribArray(aUV);
        gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 6 * 4, 3 * 4);
        gl.enableVertexAttribArray(aDepth);
        gl.vertexAttribPointer(aDepth, 1, gl.FLOAT, false, 6 * 4, 5 * 4);

        gl.uniformMatrix4fv(shader.shaderUniforms.uVP, false, viewProj);
        gl.uniform1i(shader.shaderUniforms.uTex, 0);
        gl.uniform3fv(shader.shaderUniforms.uTint, this.tintFor(waterTint));
        gl.uniform1f(shader.shaderUniforms.uTime, worldTime);
        // GLSL ES 1.00 has no uniform initializers, so the default of uWaveAmp is set here
        gl.uniform1f(shader.shaderUniforms.uWaveAmp, 0.08);
        // alpha from shallow to deep by the vertex depth; opaque for magma and slime
        var shallowAlpha = 1.0, deepAlpha = 1.0;
        if (this.transparent) {
            shallowAlpha = this.ocean ? OCEAN_SHALLOW_ALPHA : WATER_SHALLOW_ALPHA;
            deepAlpha    = this.ocean ? OCEAN_DEEP_ALPHA : WATER_DEEP_ALPHA;
        }
        gl.uniform1f(shader.shaderUniforms.uShallowAlpha, shallowAlpha);
        gl.uniform1f(shader.shaderUniforms.uDeepAlpha, deepAlpha);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex.texture);
        // Wireframe view (F2): the triangle edges, for my_web_wow's PolygonMode(Line)
        if (config.getRenderLiquidPolygons()) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineEbo);
            gl.drawElements(gl.LINES, this.indexCnt * 2, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawElements(gl.TRIANGLES, this.indexCnt, gl.UNSIGNED_SHORT, 0);
        }

        // attribute 0 stays enabled: the scene enables it for the shaders drawn after this one
        if (aPos != 0) gl.disableVertexAttribArray(aPos);
        if (aUV != 0) gl.disableVertexAttribArray(aUV);
        if (aDepth != 0) gl.disableVertexAttribArray(aDepth);
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
        this.buildBuffers(sceneApi, this.pendingHeights, this.pendingDepths, this.pendingTileFlags);
        this.pendingHeights   = null;                   // release CPU memory
        this.pendingDepths    = null;
        this.pendingTileFlags = null;

        return true;
    }

    /* Returns true when textures are ready. */
    ensureTextures(sceneApi) {
        if (this.textures.length > 0) return true;

        if (!this.liquidTexturePattern && this.liquidTypeId != 0) {
            var liquidTypes = sceneApi.dbc.getLiquidTypeDBC();
            if (!liquidTypes) return false;                 // LiquidType.dbc not loaded yet
            this.initFromLiquidType(liquidTypes[this.liquidTypeId]);
        }

        if (!this.liquidTexturePattern) return false;

        if (!this.texturePromise) {
            this.texturePromise = this.loadTextures(sceneApi,
                this.liquidTexturePattern, this.liquidTextureFirst, this.liquidTextureLast);
        }

        return false;
    }

    // GPU buffer builders

    buildBuffers(sceneApi, heights, depths, tileFlags) {
        var verts = [];
        var idx   = [];

        for (var j = 0; j <= this.ytiles; j++)
        for (var i = 0; i <= this.xtiles; i++) {
            var p = j * (this.xtiles + 1) + i;
            var h = heights[p];
            if (h > 100000) h = this.wmo ? this.pos[2] : this.pos[1];

            var nx, ny;
            if (this.wmo) {
                // WMO local coordinates (z up): the columns run along x, the rows along y
                nx = this.pos[0] + this.tilesize * i;
                ny = this.pos[1] + this.tilesize * j;
            } else {
                nx = -(this.pos[2] + this.tilesize * j - ZEROPOINT);
                ny = -(this.pos[0] + this.tilesize * i - ZEROPOINT);
            }
            var nz = h;

            verts.push(nx, ny, nz, i / this.texRepeats, j / this.texRepeats, depths[p]);
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

        this.lineEbo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.lineEbo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleListToLines(indices), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // texture loading

    /* Not every liquid has all frames (river/fast_a has 16), so the frames that fail to load are skipped */
    loadTextures(sceneApi, pattern, first, last) {
        var self = this;
        var promises = [];

        for (var i = first; i <= last; i++) {
            promises.push(sceneApi.resources.loadTexture(pattern.replace("%d", String(i))).then(
                function success(texture) { return texture; },
                function error() { return null; }));
        }

        return Promise.all(promises).then(function success(loaded) {
            var textures = [];
            for (var i = 0; i < loaded.length; i++) {
                if (loaded[i]) textures.push(loaded[i]);
            }
            self.textures = textures;
        });
    }
}

export default Liquid;
