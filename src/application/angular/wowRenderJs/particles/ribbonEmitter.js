import { emitterTimedValue } from './particleEmitter.js';

/* far more than (edges per second) * (segment length) / (segment length) of any client ribbon */
const MAX_SEGMENTS = 256;

/* A piece of a ribbon (tbc's RibbonSegment): the newest is at index 0 */
class RibbonSegment {
    constructor() {
        this.posX = 0;
        this.posY = 0;
        this.posZ = 0;
        this.upX = 0;
        this.upY = 0;
        this.upZ = 0;
        this.backX = 0;
        this.backY = 0;
        this.backZ = 0;
        this.len = 0;
        this.len0 = 0;
        this.age = 0;
    }
}

/* A ribbon of one M2 instance, ported from tbc's RibbonEmitter.cs by way of my_web_wow's RibbonEmitter.cs:
 * the head follows the bone, and once it has moved more than a segment length a new head is started; the
 * trail is cut at (edges per second) * (segment length). Added to tbc: the segments also expire after the
 * edge lifetime, so the trail shrinks away when the bone stops, and they sink or rise with the ribbon's
 * gravity, as in the client. The ribbon is kept in world space, so it trails behind a moving model too. */
export default class RibbonEmitter {
    constructor(def) {
        this.def = def;
        this.segs = [];

        // tbc: numsegs = res, seglen = length, length = res * seglen
        this.seglen = Math.max(def.edgeLifetime, 0.01);
        this.length = Math.max(def.edgesPerSecond, 1) * this.seglen;
        // the client keeps an edge at least a quarter of a second
        this.lifetime = Math.max(def.edgeLifetime, 0.25);

        this.started = false;
        this.tposX = 0;
        this.tposY = 0;
        this.tposZ = 0;
        this.tcolor = [1, 1, 1, 1];
        this.tabove = 0;
        this.tbelow = 0;

        this.texture = null;
        this.wrapX = false;
        this.wrapY = false;
        this.blend = 4;
        this.renderFlags = 0;
    }

    clear() {
        this.segs.length = 0;
        this.started = false;
    }

    /* tbc's Setup: moves the head to the bone (boneWorld = the placement times the bone matrix), adds and
     * drops segments, and evaluates the colour and heights for the model's animation. dt in seconds. */
    update(dt, boneWorld, am, anim, time, animLength) {
        var def = this.def;
        var visibility = emitterTimedValue(am, 4, def.visibility, anim, time, animLength);
        if (visibility && visibility[0] == 0) {
            // hidden for this animation: start a new trail when it shows again
            this.clear();
            return;
        }

        var m = boneWorld;
        var x = def.position.x, y = def.position.y, z = def.position.z;
        var ntposX = m[0] * x + m[4] * y + m[8] * z + m[12];
        var ntposY = m[1] * x + m[5] * y + m[9] * z + m[13];
        var ntposZ = m[2] * x + m[6] * y + m[10] * z + m[14];
        // not normalised (tbc normalised it in model space, then drew with the model's matrix): the heights
        // above / below scale with the placement, like the model
        var ntupX = m[8], ntupY = m[9], ntupZ = m[10];

        var segs = this.segs;
        if (!this.started) {
            segs.length = 0;
            var headSeg = new RibbonSegment();
            headSeg.posX = ntposX; headSeg.posY = ntposY; headSeg.posZ = ntposZ;
            headSeg.upX = ntupX; headSeg.upY = ntupY; headSeg.upZ = ntupZ;
            segs.push(headSeg);
            this.tposX = ntposX; this.tposY = ntposY; this.tposZ = ntposZ;
            this.started = true;
        }
        var dx = ntposX - this.tposX, dy = ntposY - this.tposY, dz = ntposZ - this.tposZ;
        var dlen = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // the older segments age, and move with the gravity (z += g * age^2, as in the client)
        for (var i = 1; i < segs.length; i++) {
            var s = segs[i];
            s.posZ += def.gravity * (2 * s.age * dt + dt * dt);
            s.age += dt;
        }

        // move the first segment
        var first = segs[0];
        if (first.len > this.seglen && segs.length < MAX_SEGMENTS) {
            // close it and start a new head (tbc changed a copy of the struct here, so back and len0 were
            // lost and the trail's last vertex was computed with len0 = 0)
            if (dlen > 1e-6) {
                first.backX = -dx / dlen;
                first.backY = -dy / dlen;
                first.backZ = -dz / dlen;
            }
            first.len0 = first.len;
            var newSeg = new RibbonSegment();
            newSeg.posX = ntposX; newSeg.posY = ntposY; newSeg.posZ = ntposZ;
            newSeg.upX = ntupX; newSeg.upY = ntupY; newSeg.upZ = ntupZ;
            newSeg.len = dlen;
            segs.unshift(newSeg);
        } else {
            first.upX = ntupX; first.upY = ntupY; first.upZ = ntupZ;
            first.posX = ntposX; first.posY = ntposY; first.posZ = ntposZ;
            first.len += dlen;
        }

        // cut the trail at its length: the segment crossing it keeps the part within the length
        // (tbc kept the part beyond it, l - length)
        var l = 0;
        for (var i = 0; i < segs.length; i++) {
            l += segs[i].len;
            if (l > this.length) {
                segs[i].len = Math.max(segs[i].len - (l - this.length), 0);
                segs.length = i + 1;
                break;
            }
        }

        // expire the segments older than the edge lifetime (the head never does)
        while (segs.length > 1 && segs[segs.length - 1].age > this.lifetime)
            segs.pop();

        this.tposX = ntposX; this.tposY = ntposY; this.tposZ = ntposZ;

        var color = emitterTimedValue(am, 0, def.color, anim, time, animLength);
        var alpha = emitterTimedValue(am, 2, def.alpha, anim, time, animLength);
        var above = emitterTimedValue(am, 4, def.heightAbove, anim, time, animLength);
        var below = emitterTimedValue(am, 4, def.heightBelow, anim, time, animLength);
        this.tcolor[0] = color ? color[0] : 1;
        this.tcolor[1] = color ? color[1] : 1;
        this.tcolor[2] = color ? color[2] : 1;
        this.tcolor[3] = alpha ? alpha[0] : 1;
        this.tabove = above ? above[0] : 0;
        this.tbelow = below ? below[0] : 0;
    }

    /* tbc's Draw: the quad strip from the head to the oldest segment, plus the oldest segment's own length
     * back along its direction. The texture runs along the trail by age (0 at the head, 1 at the edge
     * lifetime; tbc: by distance over the full length, which the expiry would leave half used), and across
     * it from above (0) to below (1). */
    addQuads(renderer) {
        var segs = this.segs;
        var above = this.tabove, below = this.tbelow;
        var color = this.tcolor;
        if (segs.length < 2 || color[3] <= 0 || (above == 0 && below == 0)) return;

        var s = segs[0];
        var prevU = 0;
        var prevTopX = s.posX + s.upX * above, prevTopY = s.posY + s.upY * above, prevTopZ = s.posZ + s.upZ * above;
        var prevBotX = s.posX - s.upX * below, prevBotY = s.posY - s.upY * below, prevBotZ = s.posZ - s.upZ * below;
        var lastStep = 0;

        for (var i = 1; i <= segs.length; i++) {
            var topX, topY, topZ, botX, botY, botZ, u;
            if (i < segs.length) {
                s = segs[i];
                topX = s.posX + s.upX * above; topY = s.posY + s.upY * above; topZ = s.posZ + s.upZ * above;
                botX = s.posX - s.upX * below; botY = s.posY - s.upY * below; botZ = s.posZ - s.upZ * below;
                u = Math.min(s.age / this.lifetime, 1);
            } else {
                // the oldest segment's own length (tbc: len / len0 times the unit back vector)
                s = segs[segs.length - 1];
                if (s.len <= 1e-4 || s.len0 <= 0) break;
                var ex = s.backX * s.len, ey = s.backY * s.len, ez = s.backZ * s.len;
                topX = s.posX + s.upX * above + ex; topY = s.posY + s.upY * above + ey; topZ = s.posZ + s.upZ * above + ez;
                botX = s.posX - s.upX * below + ex; botY = s.posY - s.upY * below + ey; botZ = s.posZ - s.upZ * below + ez;
                u = Math.min(prevU + Math.max(lastStep, 0), 1);
            }

            renderer.addRibbonQuad(prevTopX, prevTopY, prevTopZ, prevBotX, prevBotY, prevBotZ,
                topX, topY, topZ, botX, botY, botZ, prevU, u, color);
            lastStep = u - prevU;
            prevU = u;
            prevTopX = topX; prevTopY = topY; prevTopZ = topZ;
            prevBotX = botX; prevBotY = botY; prevBotZ = botZ;
        }
    }
}
