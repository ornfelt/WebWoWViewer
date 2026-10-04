import {vec3, mat4} from 'gl-matrix'
import fileLoader from './../../services/fileLoader.js';
import fileReadHelper from './../../services/fileReadHelper.js';
import Sky from './sky.js';
import config from './../../services/config.js';
import { triangleListToLines } from '../geometry/wireframe.js';

const rad = 400.0;

//.......................top....med....medh........horiz..........bottom
const angles = [ 90.0, 30.0, 15.0, 5.0, 0.0, -30.0, -90.0 ];
const skycolors = [ 2, 3, 4, 5, 6, 7, 7 ];

const hseg = 32;

/* The sky of a map: the lights of its lights.lit, blended by camera position and time of day and drawn as a dome */
class Skies {
    constructor(sceneApi, basename, force) {
        // TODO: my extracted wotlk mpq dir doesn't contain lit files for some
        // reason... My hosted mpq server returned an alternative file which
        // prevented this code from exploding... Maybe fix in hosted mpq server?

        var self = this;
        this.sceneApi = sceneApi;
        var fn = "World\\Maps\\" + basename + "\\lights.lit";

        this.skies = [];
        this.colorSet = new Array(18);
        for (var i = 0; i < 18; i++) {
            this.colorSet[i] = vec3.create();
        }

        this.numSkies = 0;
        this.cs = -1;
        // set by dispose(): a lights.lit that finishes loading afterwards is dropped
        this.disposed = false;

        var forceDefaultSky = false;
        if (forceDefaultSky) {
            this.loadFrom("World\\Maps\\Kalimdor\\lights.lit", true);
        } else {
            this.loadFrom(fn, false).then(function (succ) {
                if (!succ && force) {
                    self.loadFrom("World\\Maps\\Kalimdor\\lights.lit", true);
                }
            });
        }
    }

    loadFrom(path, forced) {
        var self = this;
        return fileLoader(path).then(function success(data) {
            if (self.disposed) return false;

            var br = fileReadHelper(data);
            var off = { offs: 4 };        // skip first 4 bytes (version)

            var nSkies = br.readInt32(off);
            var nSkiesInFile = nSkies;
            if (forced && nSkies > 1) nSkies = 1;
            self.numSkies = nSkies;

            // 1) construct skies
            for (var i = 0; i < self.numSkies; i++)
                self.skies.push(new Sky(br, off));

            // the colour blocks follow the headers (64 bytes each) of all skies in the file
            off.offs = 8 + nSkiesInFile * 64;

            // 2) call init for each
            for (var i = 0; i < self.numSkies; i++)
                self.skies[i].init(br, off);

            // Sort skies from smallest to largest; global last
            self.skies.sort(function (a, b) {
                return a.compareTo(b);
            });

            if (self.skies.length > 0) self.initGpu();

            return true;
        }, function error() {
            return false;
        });
    }

    dispose() {
        this.disposed = true;

        // GPU objects only exist when a lights.lit was loaded (initGpu)
        if (!this.skyVbo) return;

        var gl = this.sceneApi.getGlContext();
        gl.deleteBuffer(this.skyVbo);
        gl.deleteBuffer(this.skyEbo);
        gl.deleteBuffer(this.skyLineEbo);
    }

    findSkyWeights(pos) {
        var maxSky = this.skies.length - 1;
        this.skies[maxSky].weight = 1.0;
        this.cs = maxSky;

        for (var i = maxSky - 1; i >= 0; i--) {
            var s = this.skies[i];
            var dist = vec3.distance(pos, s.pos);

            if (dist < s.r1) {
                // We're in a sky, zero out the rest
                s.weight = 1.0;
                this.cs = i;
                for (var j = i + 1; j < this.skies.length; j++) {
                    this.skies[j].weight = 0.0;
                }
            } else if (dist < s.r2) {
                // We're in an outer area, scale down the other weights
                var r = (dist - s.r1) / (s.r2 - s.r1);
                s.weight = 1.0 - r;
                for (var j = i + 1; j < this.skies.length; j++) {
                    this.skies[j].weight *= r;
                }
            } else {
                s.weight = 0.0;
            }
        }
        // Weights are all normalized at this point :D
    }

    initSky(pos, t) {
        if (this.skies.length == 0) return;

        this.findSkyWeights(pos);

        for (var i = 0; i < 18; i++) {
            this.colorSet[i] = vec3.fromValues(0, 0, 0);
        }

        // Interpolation
        for (var j = 0; j < this.skies.length; j++) {
            if (this.skies[j].weight > 0) {
                // Now calculate the color rows
                for (var i = 0; i < 18; i++) {
                    vec3.scaleAndAdd(this.colorSet[i], this.colorSet[i], this.skies[j].colorFor(i, t), this.skies[j].weight);
                }
            }
        }
    }

    initGpu() {
        var gl = this.sceneApi.getGlContext();

        // 7 latitude rings x hseg slices
        var rings = 7;                   // angles.length
        var slices = hseg;               // 32
        var verts = [];
        var idx = [];

        for (var r = 0; r < rings; r++) {
            var ang = Math.PI * angles[r] / 180;
            var y = Math.sin(ang) * rad;
            var xy = Math.cos(ang) * rad;

            for (var s = 0; s <= slices; s++) {          // extra vert for seam
                var a = 2 * Math.PI * s / slices;
                var ox = xy * Math.cos(a);        // original X  (east / west)
                var oz = xy * Math.sin(a);        // original Z  (south / north)

                // swizzle to match coordinate system
                var nx = -oz;      // new X
                var ny = -ox;      // new Y
                var nz = y;        // new Z (height)

                verts.push(nx, ny, nz, r);
            }
        }

        for (var r = 0; r < rings - 1; r++) {
            for (var s = 0; s < slices; s++) {
                var i0 = r * (slices + 1) + s;
                var i1 = (r + 1) * (slices + 1) + s;
                var i2 = i0 + 1;
                var i3 = i1 + 1;

                idx.push(i0, i1, i2, i2, i1, i3);
            }
        }
        this.skyIndexCnt = idx.length;

        // upload
        this.skyVbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        this.skyEbo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.skyEbo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

        this.skyLineEbo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.skyLineEbo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangleListToLines(idx), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    drawSky(camPos, view, proj, time) {
        if (this.numSkies == 0) return false;

        this.initSky(camPos, time);          // updates colorSet[]

        // Build the 7 colors array the shader wants
        var cols = new Float32Array(7 * 3);
        for (var i = 0; i < 7; i++) cols.set(this.colorSet[skycolors[i]], i * 3);

        // Strip translation so sphere follows camera
        var viewNoPos = mat4.clone(view);
        viewNoPos[12] = 0;
        viewNoPos[13] = 0;
        viewNoPos[14] = 0;

        var gl = this.sceneApi.getGlContext();
        var skyShader = this.sceneApi.shaders.getSkyShader();

        // state
        gl.depthMask(false);
        gl.disable(gl.DEPTH_TEST);

        gl.useProgram(skyShader.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.skyEbo);

        // layout: vec3 position + float rowIdx
        var aPos = skyShader.shaderAttributes.aPos;
        var aRow = skyShader.shaderAttributes.aRow;
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 4 * 4, 0);
        gl.enableVertexAttribArray(aRow);
        gl.vertexAttribPointer(aRow, 1, gl.FLOAT, false, 4 * 4, 3 * 4);

        gl.uniformMatrix4fv(skyShader.shaderUniforms.uProj, false, proj);
        gl.uniformMatrix4fv(skyShader.shaderUniforms.uViewNoPos, false, viewNoPos);

        gl.uniform3fv(skyShader.shaderUniforms.uColors, cols);

        // Wireframe view (F5): the triangle edges, for my_web_wow's PolygonMode(Line)
        if (config.getRenderSkyPolygons()) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.skyLineEbo);
            gl.drawElements(gl.LINES, this.skyIndexCnt * 2, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawElements(gl.TRIANGLES, this.skyIndexCnt, gl.UNSIGNED_SHORT, 0);
        }

        gl.disableVertexAttribArray(aPos);
        gl.disableVertexAttribArray(aRow);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);

        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);

        return true;
    }

    getSkyName() {
        if (this.cs == -1)
            return "[no sky]";
        else
            return this.skies[this.cs].name;
    }

    hasSkies() {
        return this.numSkies > 0;
    }
}

export default Skies;
