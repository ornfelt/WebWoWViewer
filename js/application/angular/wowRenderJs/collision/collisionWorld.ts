import {vec3} from 'gl-matrix'
import config from './../../services/config';
import type {ReadonlyVec3} from 'gl-matrix'

/*
 * Collision triangles exported by the wc_clean_new gfx tool (*.wctris files, "WCTR" binary format),
 * served by the mpq server's collision api, and the ray / ground / slide queries used for
 * collision-based movement and gravity. Based on my_web_wow's CollisionWorld.cs.
 *
 * The exported triangles are in "wc" coordinates (Y-up); every vertex is converted to the "wow"
 * coordinates (Z-up) the camera and the rest of the viewer use, so everything here is in wow space.
 *
 * The triangle intersection test is a port of the gfx engine's Physics.triangle_collide /
 * find_nearest_triangle (Möller–Trumbore, one-sided: back-faces relative to the ray are ignored).
 *
 * A uniform XY grid is used as a broad-phase so per-frame ray casts only test the handful of
 * triangles near the query instead of the whole map.
 */

// Mirror of Phys.PhysicsDefines.EPSILON in the source project.
const EPSILON = 0.0000001;

// Broad-phase grid cell size (wow units). A bit under one map chunk (33.3).
const CELL_SIZE = 16.0;

/* "WCTR" header: magic, version, flags, bounds[6], triCount */
const HEADER_SIZE = 4 + 4 + 4 + 6 * 4 + 4;
/* one triangle: 3 vertices of 3 floats */
const TRIANGLE_SIZE = 9 * 4;

export interface RaycastHit {
    /* distance along the ray */
    t: number;
    /* unit surface normal */
    normal: vec3;
}

export interface GroundHit {
    groundZ: number;
    normal: vec3;
}

function cellCoord(v: number): number {
    return Math.floor(v / CELL_SIZE);
}
/* the cell coordinates stay within +-32768 (the map is +-17066 wow units), so this key is unique */
function cellKey(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
}

class CollisionWorld {
    /* 9 floats per triangle: p0, p1, p2 (wow space) */
    tris: Float32Array;
    triangleCount: number;

    // Indices of roughly up-facing ("walkable") triangles, used when respawning.
    walkable: number[];

    // Uniform XY grid: cell key -> triangle indices overlapping that cell.
    grid: Map<number, number[]>;

    // Scratch for per-query de-duplication of candidate triangles.
    stamp: Int32Array;
    stampValue: number;
    candidates: number[];

    /* world-space AABB of all triangles */
    boundsMin: vec3;
    boundsMax: vec3;

    constructor(tris: Float32Array) {
        this.tris = tris;
        this.triangleCount = tris.length / 9;
        this.walkable = [];
        this.grid = new Map();
        this.stamp = new Int32Array(this.triangleCount);
        this.stampValue = 0;
        this.candidates = [];

        var min = vec3.fromValues(Infinity, Infinity, Infinity);
        var max = vec3.fromValues(-Infinity, -Infinity, -Infinity);

        var a = vec3.create(), b = vec3.create(), c = vec3.create();
        var e1 = vec3.create(), e2 = vec3.create(), n = vec3.create();
        for (var i = 0; i < this.triangleCount; i++) {
            this.getTriangle(i, a, b, c);

            vec3.min(min, min, a); vec3.min(min, min, b); vec3.min(min, min, c);
            vec3.max(max, max, a); vec3.max(max, max, b); vec3.max(max, max, c);

            // Up-facing test (Z-up): normal.Z dominant and positive.
            vec3.cross(n, vec3.subtract(e1, b, a), vec3.subtract(e2, c, a));
            if (vec3.squaredLength(n) > 1e-12) {
                vec3.normalize(n, n);
                if (n[2] > 0.5)
                    this.walkable.push(i);
            }

            this.insertIntoGrid(i, a, b, c);
        }

        if (this.triangleCount === 0) {
            min = vec3.create();
            max = vec3.create();
        }

        this.boundsMin = min;
        this.boundsMax = max;
    }

    /* lowest Z of any triangle (used for the "under the map" check) */
    get minZ(): number {
        return this.boundsMin[2];
    }
    /* true when there is no geometry; callers should fall back to free movement */
    get empty(): boolean {
        return this.triangleCount === 0;
    }

    getTriangle(i: number, a: vec3, b: vec3, c: vec3) {
        var t = this.tris, o = i * 9;
        vec3.set(a, t[o],     t[o + 1], t[o + 2]);
        vec3.set(b, t[o + 3], t[o + 4], t[o + 5]);
        vec3.set(c, t[o + 6], t[o + 7], t[o + 8]);
    }

    // ------------------------------------------------------------------
    // Loading
    // ------------------------------------------------------------------

    /*
     * Loads every <mapName>.wctris and <mapName>_*.wctris file the mpq server has (GET collision/<map> lists
     * them, GET collision/<map>/<file> serves one). Always resolves to a world (possibly empty) so callers can
     * simply check empty.
     */
    static async load(mapName: string | undefined): Promise<CollisionWorld> {
        var parts: Float32Array[] = [];

        try {
            if (!mapName) {
                console.log("[Collision] no map name specified, collision disabled.");
                return new CollisionWorld(new Float32Array(0));
            }

            var mapUrl = config.getUrlToLoadCollision() + encodeURIComponent(mapName);
            var listResponse = await fetch(mapUrl);
            if (!listResponse.ok) {
                console.log("[Collision] " + mapUrl + " returned " + listResponse.status + ", collision disabled");
                return new CollisionWorld(new Float32Array(0));
            }
            var files: string[] = await listResponse.json();

            for (var file of files) {
                try {
                    var response = await fetch(mapUrl + '/' + encodeURIComponent(file));
                    if (!response.ok) throw new Error("HTTP " + response.status);
                    var part = CollisionWorld.readFile(file, await response.arrayBuffer());
                    if (part !== null) parts.push(part);
                } catch (e) {
                    console.log("[Collision] failed to read " + file + ": " + (e as Error).message);
                }
            }

            var count = 0;
            for (var p of parts) count += p.length;
            var tris = new Float32Array(count);
            var offset = 0;
            for (var p of parts) {
                tris.set(p, offset);
                offset += p.length;
            }

            console.log("[Collision] loaded " + (count / 9) + " triangles from " + files.length + " file(s) for map '" + mapName + "'");
            return new CollisionWorld(tris);
        } catch (e) {
            console.log("[Collision] load error: " + (e as Error).message);
        }

        return new CollisionWorld(new Float32Array(0));
    }

    /* the triangles of one file, converted from wc to wow space; null for a bad magic */
    static readFile(fileName: string, buffer: ArrayBuffer): Float32Array | null {
        var view = new DataView(buffer);

        if (buffer.byteLength < HEADER_SIZE || view.getUint8(0) !== 0x57 /* W */ || view.getUint8(1) !== 0x43 /* C */ ||
            view.getUint8(2) !== 0x54 /* T */ || view.getUint8(3) !== 0x52 /* R */) {
            console.log("[Collision] " + fileName + ": bad magic, skipping");
            return null;
        }

        // version, flags and bounds are unused (the bounds are recomputed)
        var count = view.getUint32(HEADER_SIZE - 4, true);
        if (HEADER_SIZE + count * TRIANGLE_SIZE > buffer.byteLength)
            throw new Error("file ends before its " + count + " triangles");

        var tris = new Float32Array(count * 9);
        var pos = HEADER_SIZE;
        for (var i = 0; i < count * 3; i++) {
            // wc -> wow: (x, y, z) -> (x, -z, y), as Vector3Extensions.FromWc
            var x = view.getFloat32(pos, true);
            var y = view.getFloat32(pos + 4, true);
            var z = view.getFloat32(pos + 8, true);
            tris[i * 3]     = x;
            tris[i * 3 + 1] = -z;
            tris[i * 3 + 2] = y;
            pos += 12;
        }
        return tris;
    }

    // ------------------------------------------------------------------
    // Broad-phase grid
    // ------------------------------------------------------------------

    insertIntoGrid(idx: number, a: ReadonlyVec3, b: ReadonlyVec3, c: ReadonlyVec3) {
        var minX = Math.min(a[0], b[0], c[0]);
        var maxX = Math.max(a[0], b[0], c[0]);
        var minY = Math.min(a[1], b[1], c[1]);
        var maxY = Math.max(a[1], b[1], c[1]);

        var cx0 = cellCoord(minX), cx1 = cellCoord(maxX);
        var cy0 = cellCoord(minY), cy1 = cellCoord(maxY);

        for (var cx = cx0; cx <= cx1; cx++) {
            for (var cy = cy0; cy <= cy1; cy++) {
                var key = cellKey(cx, cy);
                var list = this.grid.get(key);
                if (list === undefined) {
                    list = [];
                    this.grid.set(key, list);
                }
                list.push(idx);
            }
        }
    }

    // Gather (de-duplicated) candidate triangles whose cells overlap the XY box.
    gatherCandidates(minX: number, minY: number, maxX: number, maxY: number) {
        var candidates = this.candidates;
        candidates.length = 0;
        this.stampValue++;

        var cx0 = cellCoord(minX), cx1 = cellCoord(maxX);
        var cy0 = cellCoord(minY), cy1 = cellCoord(maxY);

        for (var cx = cx0; cx <= cx1; cx++) {
            for (var cy = cy0; cy <= cy1; cy++) {
                var list = this.grid.get(cellKey(cx, cy));
                if (list === undefined)
                    continue;
                for (var j = 0; j < list.length; j++) {
                    var idx = list[j];
                    if (this.stamp[idx] === this.stampValue) continue;
                    this.stamp[idx] = this.stampValue;
                    candidates.push(idx);
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Intersection (port of Physics.triangle_collide)
    // ------------------------------------------------------------------

    /* the distance along the ray, or -1 for no hit; the (unnormalized) triangle normal goes to normp. Scalar math, it runs for every candidate */
    triangleCollide(i: number, src: ReadonlyVec3, dir: ReadonlyVec3, normp: vec3): number {
        var t = this.tris, o = i * 9;
        var p0x = t[o], p0y = t[o + 1], p0z = t[o + 2];
        var e1x = t[o + 3] - p0x, e1y = t[o + 4] - p0y, e1z = t[o + 5] - p0z;
        var e2x = t[o + 6] - p0x, e2y = t[o + 7] - p0y, e2z = t[o + 8] - p0z;

        // p = dir x e2
        var px = dir[1] * e2z - dir[2] * e2y;
        var py = dir[2] * e2x - dir[0] * e2z;
        var pz = dir[0] * e2y - dir[1] * e2x;
        var det = e1x * px + e1y * py + e1z * pz;

        if (det < EPSILON) return -1.0;

        var inv = 1.0 / det;

        var ttx = src[0] - p0x, tty = src[1] - p0y, ttz = src[2] - p0z;
        var u = (ttx * px + tty * py + ttz * pz) * inv;
        if (u < -EPSILON || u > 1.0 + EPSILON) return -1.0;

        // q = tt x e1
        var qx = tty * e1z - ttz * e1y;
        var qy = ttz * e1x - ttx * e1z;
        var qz = ttx * e1y - tty * e1x;
        var v = (dir[0] * qx + dir[1] * qy + dir[2] * qz) * inv;
        if (v < -EPSILON || (u + v) > 1.0 + EPSILON) return -1.0;

        // norm = e1 x e2
        var nx = e1y * e2z - e1z * e2y;
        var ny = e1z * e2x - e1x * e2z;
        var nz = e1x * e2y - e1y * e2x;

        // One-sided: ignore triangles facing away from the ray (same as source).
        if (dir[0] * nx + dir[1] * ny + dir[2] * nz >= -EPSILON) return -1.0;

        vec3.set(normp, nx, ny, nz);
        return (e2x * qx + e2y * qy + e2z * qz) * inv;
    }

    /* Nearest triangle hit by the ray (src, normalized dir) within dirLen, or null */
    raycast(src: ReadonlyVec3, dir: ReadonlyVec3, dirLen: number): RaycastHit | null {
        if (this.triangleCount === 0) return null;

        // XY footprint of the segment, with a little margin for grid boundaries.
        var end = vec3.scaleAndAdd(vec3.create(), src, dir, dirLen);
        var m = 1.0;
        var minX = Math.min(src[0], end[0]) - m, maxX = Math.max(src[0], end[0]) + m;
        var minY = Math.min(src[1], end[1]) - m, maxY = Math.max(src[1], end[1]) + m;
        this.gatherCandidates(minX, minY, maxX, maxY);

        var lowest = Infinity;
        var found = false;
        var normal = vec3.create();
        var triNorm = vec3.create();

        var candidates = this.candidates;
        for (var j = 0; j < candidates.length; j++) {
            var tmp = this.triangleCollide(candidates[j], src, dir, triNorm);
            if (tmp < 0.0 || tmp > dirLen + EPSILON) continue;
            if (tmp >= lowest) continue;
            lowest = tmp;
            vec3.copy(normal, triNorm);
            found = true;
        }

        if (!found) return null;
        return {
            t: lowest,
            normal: vec3.normalize(normal, normal)
        };
    }

    // ------------------------------------------------------------------
    // Movement helpers
    // ------------------------------------------------------------------

    /* Collide-and-slide a sphere of radius from pos by delta. Stops short of walls and slides along them. */
    slideMove(pos: ReadonlyVec3, delta: ReadonlyVec3, radius: number): vec3 {
        var maxIter = 4;
        var result = vec3.clone(pos);
        var remaining = vec3.clone(delta);
        var dir = vec3.create();
        for (var iter = 0; iter < maxIter; iter++) {
            var len = vec3.length(remaining);
            if (len < 1e-5) break;

            vec3.scale(dir, remaining, 1 / len);
            var hit = this.raycast(result, dir, len + radius);
            if (hit !== null) {
                var allowed = Math.max(0, hit.t - radius);
                vec3.scaleAndAdd(result, result, dir, allowed);

                // Remaining motion projected onto the surface plane (slide).
                vec3.scale(remaining, dir, len - allowed);
                vec3.scaleAndAdd(remaining, remaining, hit.normal, -vec3.dot(remaining, hit.normal));
            } else {
                vec3.add(result, result, remaining);
                break;
            }
        }
        return result;
    }

    /*
     * Finds the nearest ground surface beneath pos (cast straight down), or null.
     * searchUp lets the probe start above pos so small upward steps are also detected;
     * searchDown is how far below to look.
     */
    groundBelow(pos: ReadonlyVec3, searchUp: number, searchDown: number): GroundHit | null {
        var start = vec3.fromValues(pos[0], pos[1], pos[2] + searchUp);
        var maxLen = searchUp + searchDown;
        var hit = this.raycast(start, [0, 0, -1], maxLen);
        if (hit !== null) {
            return {
                groundZ: start[2] - hit.t,
                normal: hit.normal
            };
        }
        return null;
    }

    /*
     * Returns a position on top of a random walkable (up-facing) triangle, raised by offsetUp.
     * Used to recover when the player is under the map.
     */
    randomTopPosition(offsetUp: number): vec3 {
        if (this.triangleCount === 0) return vec3.create();

        var idx: number;
        if (this.walkable.length > 0)
            idx = this.walkable[Math.floor(Math.random() * this.walkable.length)];
        else
            idx = Math.floor(Math.random() * this.triangleCount);

        var a = vec3.create(), b = vec3.create(), c = vec3.create();
        this.getTriangle(idx, a, b, c);
        var centroid = vec3.add(vec3.create(), a, b);
        vec3.add(centroid, centroid, c);
        vec3.scale(centroid, centroid, 1 / 3);
        centroid[2] += offsetUp;
        return centroid;
    }
}

export default CollisionWorld;
