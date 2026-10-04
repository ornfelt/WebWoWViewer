/* WebGL 1 has no glPolygonMode(GL_LINE), which my_web_wow switches on for its wireframe views
 * (F1 - F5): these build a second index buffer with the edges of the triangles, drawn as gl.LINES */

/* The 3 edges of every triangle of a triangle list: 6 line indices per triangle, so drawing
 * count indices from offset becomes drawing 2 * count line indices from 2 * offset.
 * A degenerate triangle becomes zero-length lines (not drawn), which keeps that mapping */
export function triangleListToLines(indices) {
    var lines = new Uint16Array(indices.length * 2);
    for (var t = 0; t + 2 < indices.length; t += 3) {
        var a = indices[t], b = indices[t + 1], c = indices[t + 2];
        if (a == b || b == c || c == a) {
            b = a;
            c = a;
        }
        var o = t * 2;
        lines[o]     = a; lines[o + 1] = b;
        lines[o + 2] = b; lines[o + 3] = c;
        lines[o + 4] = c; lines[o + 5] = a;
    }
    return lines;
}

/* The edges of the triangles of each strip, strip i being strips[stripOffsets[i] .. stripOffsets[i + 1]).
 * The degenerate triangles that join the rows of a strip are skipped (they have no edges to show) */
export function triangleStripsToLines(strips, stripOffsets) {
    var lines = [];
    var lineOffsets = [];
    for (var i = 0; i + 1 < stripOffsets.length; i++) {
        lineOffsets.push(lines.length);
        for (var k = stripOffsets[i]; k + 2 < stripOffsets[i + 1]; k++) {
            var a = strips[k], b = strips[k + 1], c = strips[k + 2];
            if (a == b || b == c || c == a) continue;
            lines.push(a, b, b, c, c, a);
        }
    }
    lineOffsets.push(lines.length);
    // { lines, lineOffsets }: the lines of strip i are lines[lineOffsets[i] .. lineOffsets[i + 1])
    return { lines: new Uint16Array(lines), lineOffsets: lineOffsets };
}
