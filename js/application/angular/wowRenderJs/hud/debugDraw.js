const FLOATS_2D = 6; // x,y, r,g,b,a
const FLOATS_3D = 7; // x,y,z, r,g,b,a

/*
 * Batched, shader-based debug + HUD drawing, as my_web_wow's DebugDraw.cs: accumulate primitives, then
 * flush them with the debug2DShader / debug3DShader. 2D: pixel coordinates, origin TOP-LEFT, +y down.
 * 3D: world space. WebGL 1 has no VAOs without an extension, so the attributes are set up per flush.
 */
class DebugDraw {
    constructor(scene) {
        this.scene = scene;
        this.vbo2D = scene.gl.createBuffer();
        this.vbo3D = scene.gl.createBuffer();
        this.lines2D = [];
        this.tris2D = [];
        this.lines3D = [];
        this.tris3D = [];
    }

    // ---------------- public 2D API (pixel space) ----------------
    line2D(x1, y1, x2, y2, c) {
        this.lines2D.push(x1, y1, c[0], c[1], c[2], c[3]);
        this.lines2D.push(x2, y2, c[0], c[1], c[2], c[3]);
    }

    rectOutline2D(x, y, w, h, c) {
        this.line2D(x,     y,     x + w, y,     c);
        this.line2D(x + w, y,     x + w, y + h, c);
        this.line2D(x + w, y + h, x,     y + h, c);
        this.line2D(x,     y + h, x,     y,     c);
    }

    rectFill2D(x, y, w, h, c) {
        this.vtx2(x, y, c); this.vtx2(x + w, y, c); this.vtx2(x + w, y + h, c);
        this.vtx2(x, y, c); this.vtx2(x + w, y + h, c); this.vtx2(x, y + h, c);
    }
    vtx2(x, y, c) {
        this.tris2D.push(x, y, c[0], c[1], c[2], c[3]);
    }

    // ---------------- public 3D API (world space) ----------------
    line3D(a, b, c) {
        this.lines3D.push(a[0], a[1], a[2], c[0], c[1], c[2], c[3]);
        this.lines3D.push(b[0], b[1], b[2], c[0], c[1], c[2], c[3]);
    }

    circle3D(center, radius, c, segments = 32, zLift = 0) {
        var prev = null;
        for (var i = 0; i <= segments; i++) {
            var a = 2.0 * Math.PI * i / segments;
            var p = [
                center[0] + Math.cos(a) * radius,
                center[1] + Math.sin(a) * radius,   // ring lies on the XY plane (Z is up)
                center[2] + zLift];
            if (prev !== null) this.line3D(prev, p, c);
            prev = p;
        }
    }

    box3D(center, halfSize, c) {
        var s = halfSize;
        var P = (dx, dy, dz) => [center[0] + dx * s, center[1] + dy * s, center[2] + dz * s];
        var c000 = P(-1,-1,-1), c100 = P(1,-1,-1), c110 = P(1,1,-1), c010 = P(-1,1,-1);
        var c001 = P(-1,-1, 1), c101 = P(1,-1, 1), c111 = P(1,1, 1), c011 = P(-1,1, 1);
        this.line3D(c000, c100, c); this.line3D(c100, c110, c); this.line3D(c110, c010, c); this.line3D(c010, c000, c);
        this.line3D(c001, c101, c); this.line3D(c101, c111, c); this.line3D(c111, c011, c); this.line3D(c011, c001, c);
        this.line3D(c000, c001, c); this.line3D(c100, c101, c); this.line3D(c110, c111, c); this.line3D(c010, c011, c);
    }

    // Filled (solid) box - 12 triangles. Cull face is disabled in begin3D so winding is irrelevant.
    boxFill3D(center, halfSize, c) {
        var s = halfSize;
        var P = (dx, dy, dz) => [center[0] + dx * s, center[1] + dy * s, center[2] + dz * s];
        var c000 = P(-1, -1, -1), c100 = P(1, -1, -1), c110 = P(1, 1, -1), c010 = P(-1, 1, -1);
        var c001 = P(-1, -1, 1), c101 = P(1, -1, 1), c111 = P(1, 1, 1), c011 = P(-1, 1, 1);

        var quad = (a, b, d, e) => {
            this.vtx3(a, c); this.vtx3(b, c); this.vtx3(d, c); this.vtx3(a, c); this.vtx3(d, c); this.vtx3(e, c);
        };

        quad(c000, c100, c110, c010); // bottom (z-)
        quad(c001, c101, c111, c011); // top    (z+)
        quad(c000, c100, c101, c001); // front  (y-)
        quad(c010, c110, c111, c011); // back   (y+)
        quad(c000, c010, c011, c001); // left   (x-)
        quad(c100, c110, c111, c101); // right  (x+)
    }

    // Filled disc on the XY plane (Z is up), triangle fan.
    disc3D(center, radius, c, segments = 32, zLift = 0) {
        var ctr = [center[0], center[1], center[2] + zLift];
        var pt = (i) => {
            var a = 2.0 * Math.PI * i / segments;
            return [center[0] + Math.cos(a) * radius,
                    center[1] + Math.sin(a) * radius,
                    center[2] + zLift];
        };
        for (var i = 0; i < segments; i++) {
            this.vtx3(ctr, c); this.vtx3(pt(i), c); this.vtx3(pt(i + 1), c);
        }
    }

    vtx3(v, c) {
        this.tris3D.push(v[0], v[1], v[2], c[0], c[1], c[2], c[3]);
    }

    // ---------------- flush ----------------
    flush2D() {
        var gl = this.scene.gl;
        var sh = this.scene.debug2DShader;
        if (!sh || (this.tris2D.length === 0 && this.lines2D.length === 0)) return;

        this.useProgram(sh);
        gl.uniform2f(sh.shaderUniforms.uResolution, this.scene.canvas.width, this.scene.canvas.height);

        if (this.tris2D.length > 0)  { this.upload(sh, this.vbo2D, this.tris2D, 2, FLOATS_2D);  gl.drawArrays(gl.TRIANGLES, 0, this.tris2D.length / FLOATS_2D); }
        if (this.lines2D.length > 0) { this.upload(sh, this.vbo2D, this.lines2D, 2, FLOATS_2D); gl.drawArrays(gl.LINES, 0, this.lines2D.length / FLOATS_2D); }
        this.releaseAttribs(sh);
        this.tris2D = [];
        this.lines2D = [];
    }

    flush3D(lookAt, proj) {
        var gl = this.scene.gl;
        var sh = this.scene.debug3DShader;
        if (!sh || (this.tris3D.length === 0 && this.lines3D.length === 0)) return;

        this.useProgram(sh);
        gl.uniformMatrix4fv(sh.shaderUniforms.uLookAtMat, false, lookAt);
        gl.uniformMatrix4fv(sh.shaderUniforms.uPMatrix, false, proj);

        if (this.tris3D.length > 0)  { this.upload(sh, this.vbo3D, this.tris3D, 3, FLOATS_3D);  gl.drawArrays(gl.TRIANGLES, 0, this.tris3D.length / FLOATS_3D); }
        if (this.lines3D.length > 0) { this.upload(sh, this.vbo3D, this.lines3D, 3, FLOATS_3D); gl.drawArrays(gl.LINES, 0, this.lines3D.length / FLOATS_3D); }
        this.releaseAttribs(sh);
        this.tris3D = [];
        this.lines3D = [];
    }

    // ---------------- state begin/end ----------------
    begin2D() {
        var gl = this.scene.gl;
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.CULL_FACE);
    }
    end2D() {
        var gl = this.scene.gl;
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
    }
    begin3D(depthTest = true) {
        var gl = this.scene.gl;
        if (depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    end3D() {
        var gl = this.scene.gl;
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST); // the rest of the scene expects it on
    }

    // ---------------- helpers ----------------
    useProgram(sh) {
        // no VAO may be bound, or the attribute setup below would end up in it
        if (this.scene.vao_ext) this.scene.vao_ext.bindVertexArrayOES(null);
        this.scene.gl.useProgram(sh.program);
    }

    /* uploads data into vbo and points aPosition (size floats) and aColor (4 floats) at it */
    upload(sh, vbo, data, positionSize, floatsPerVertex) {
        var gl = this.scene.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);

        var stride = floatsPerVertex * 4;
        var aPosition = sh.shaderAttributes.aPosition;
        var aColor = sh.shaderAttributes.aColor;
        gl.enableVertexAttribArray(aPosition);
        gl.vertexAttribPointer(aPosition, positionSize, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(aColor);
        gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride, positionSize * 4);
    }

    /* the other draws enable attribute 0 themselves and do not expect any other one to be left on */
    releaseAttribs(sh) {
        var gl = this.scene.gl;
        if (sh.shaderAttributes.aPosition !== 0) gl.disableVertexAttribArray(sh.shaderAttributes.aPosition);
        if (sh.shaderAttributes.aColor !== 0) gl.disableVertexAttribArray(sh.shaderAttributes.aColor);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
}

export default DebugDraw;
