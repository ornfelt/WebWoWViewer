import {vec3} from 'gl-matrix'

function createSkyColor(t, col) {
    var color = vec3.create();
    color[2] = (col & 0x0000ff) / 255.0;
    color[1] = ((col & 0x00ff00) >> 8) / 255.0;
    color[0] = ((col & 0xff0000) >> 16) / 255.0;
    return {
        color: color,
        time: t
    };
}

const skymul = 36.0;
const TILESIZE = 533.333333333;

/* One light of a lights.lit file */
class Sky {
    constructor(br, off) {
        /* lightinfo layout  (little-endian)
           int ia, ib, ic;
           float fa, fb, fc, fd, fe;
           char name[32];
        */

        var ia = br.readInt32(off);         // 1st field
        br.readInt32(off);                  // ib - not used
        br.readInt32(off);                  // ic - not used

        var fa = br.readFloat32(off);
        var fb = br.readFloat32(off);
        var fc = br.readFloat32(off);
        var fd = br.readFloat32(off);
        var fe = br.readFloat32(off);

        // The position is in ADT placement coordinates (x and z from the map corner, y up);
        // convert it to world coordinates like adtM2Object.createPlacementMatrix() does
        this.pos = vec3.fromValues(32 * TILESIZE - fc / skymul, 32 * TILESIZE - fa / skymul, fb / skymul);
        this.r1 = fd / skymul;
        this.r2 = fe / skymul;

        this.name = br.readNZTString(off, 32);   // 32-byte C-string
        this.global = (ia == -1);

        this.weight = 0;
        this.colorRows = new Array(36);
        this.mmin = new Array(36);
        for (var i = 0; i < 36; i++) this.mmin[i] = -2;
    }

    init(br, off) {
        var ll = new Array(18);
        var buf = new Array(64);

        for (var k = 0; k < 4; k++) {
            if (k == 0 || k == 2) {
                var blockStart = off.offs + k * 0x15F0;
                var blkOff = { offs: blockStart };

                // read 18 ints
                for (var i = 0; i < 18; i++)
                    ll[i] = br.readInt32(blkOff);

                // read 18x64 ints
                for (var i = 0; i < 18; i++) {
                    for (var t = 0; t < 64; t++)
                        buf[t] = br.readInt32(blkOff);

                    var idx = Math.floor(k / 2) * 18 + i;

                    if (ll[i] == 0) {
                        this.mmin[idx] = -1;
                    } else {
                        this.mmin[idx] = buf[0];
                        var limit = Math.min(ll[i], 32);
                        for (var l = 0; l < limit; l++) {
                            var sc = createSkyColor(buf[l * 2], buf[l * 2 + 1]);
                            if (!this.colorRows[idx]) this.colorRows[idx] = [];
                            this.colorRows[idx].push(sc);
                        }
                    }
                }
            }
        }

        off.offs += 4 * 0x15F0;   // keep the caller's cursor in sync
    }

    colorFor(r, t) {
        if (this.mmin[r] < 0) {
            return vec3.fromValues(0, 0, 0);
        }

        var colorRow = this.colorRows[r];
        var c1 = vec3.create(), c2 = vec3.create();
        var t1 = 0, t2 = 0;
        var last = colorRow.length - 1;

        if (t < this.mmin[r]) {
            // Reverse interpolate
            c1 = colorRow[last].color;
            c2 = colorRow[0].color;
            t1 = colorRow[last].time;
            t2 = colorRow[0].time + 2880;
            t += 2880;
        } else {
            for (var i = last; i >= 0; i--) {
                if (colorRow[i].time <= t) {
                    c1 = colorRow[i].color;
                    t1 = colorRow[i].time;

                    if (i == last) {
                        c2 = colorRow[0].color;
                        t2 = colorRow[0].time + 2880;
                    } else {
                        c2 = colorRow[i + 1].color;
                        t2 = colorRow[i + 1].time;
                    }
                    break;
                }
            }
        }

        var tt = (t - t1) / (t2 - t1);
        var result = vec3.create();
        vec3.scale(result, c1, 1.0 - tt);
        vec3.scaleAndAdd(result, result, c2, tt);
        return result;
    }

    compareTo(s) {
        if (this.global && s.global) return 0;
        else if (this.global) return 1;
        else if (s.global) return -1;
        else return (this.r2 < s.r2) ? -1 : ((this.r2 > s.r2) ? 1 : 0);
    }
}

export default Sky;
