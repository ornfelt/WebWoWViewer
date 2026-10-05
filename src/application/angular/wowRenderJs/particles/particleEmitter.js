import {mat4} from 'gl-matrix';

// Particles and their emitters, ported from tbc's Particle.cs (itself from WoWModelViewer) by way of
// my_web_wow's ParticleEmitter.cs. The structure, the spawn loop (rate * dt + remainder) and the life ramp
// follow tbc; where tbc guessed, the WotLK client's behaviour is used instead (see the comments marked "tbc:").

/* M2 particle flags */
export const ParticleFlags = {
    VelocityOriented: 0x4,
    Fogged: 0x8,
    ModelSpace: 0x10,
    InheritScale: 0x20,
    DieMovingOut: 0x80,
    SphereUp: 0x100,
    RandomFlipSpin: 0x200,
    TailUpToAge: 0x400,
    NotBillboarded: 0x1000,
    RandomStartCell: 0x8000,
    RandomCell: 0x10000,
    Head: 0x20000,
    Tail: 0x40000,
    ScaleVaryXY: 0x80000
};

/* tbc: 10000 particles per system */
const MAX_PARTICLES = 2000;
/* longer frames are simulated in steps of this length (seconds) */
const MAX_STEP = 0.1;

/* random values for the twinkle, shared by all systems as in the client */
const randTable = [];
for (var i = 0; i < 128; i++) randTable.push(Math.random());

/* One particle (tbc's Particle): PARTICLE_FLOATS numbers in the emitter's particle data, at these offsets
 * (one typed array instead of an object per particle: no boxed numbers, no scattered loads) */
/* world space, or emitter space for emitters with the ModelSpace flag */
const P_X = 0;
const P_Y = 1;
const P_Z = 2;
const P_VX = 3;
const P_VY = 4;
const P_VZ = 5;
const P_LIFE = 6;
const P_MAX_LIFE = 7;
/* random per particle: -1..1 for the scale and spin variation, the twinkle seed and a random texture cell */
const P_RAND_SCALE_X = 8;
const P_RAND_SCALE_Y = 9;
const P_RAND_BASE_SPIN = 10;
const P_RAND_SPIN = 11;
const P_SEED = 12;
const P_CELL = 13;
const PARTICLE_FLOATS = 14;

// tbc's frand: -1..1, and 0..1
function frand() {
    return Math.random() * 2 - 1;
}
function frandPos() {
    return Math.random();
}

/* The generators (tbc's ParticleEmitter subclasses, the emission area of the system): create a particle in emitter space */
function newPlaneParticle(system, d, o) {
    // tbc: a random point of the plane, moving straight up, with the length along y and the width along x.
    // The length is along x and the width along y, and the direction is spread by the vertical
    // (polar) and horizontal (azimuth) ranges, or points away from zSource.
    var px = frand() * system.areaLength * 0.5;
    var py = frand() * system.areaWidth * 0.5;
    d[o + P_X] = px;
    d[o + P_Y] = py;
    d[o + P_Z] = 0;

    var speed = system.calcSpeed();
    if (system.zSource < 0.001) {
        var polar = system.verticalRange * frand();
        var azimuth = system.horizontalRange * frand();
        var sinPolar = Math.sin(polar);
        d[o + P_VX] = Math.cos(azimuth) * sinPolar * speed;
        d[o + P_VY] = Math.sin(azimuth) * sinPolar * speed;
        d[o + P_VZ] = Math.cos(polar) * speed;
    } else {
        var dz = -system.zSource;
        var l = Math.sqrt(px * px + py * py + dz * dz);
        var f = l > 1e-4 ? speed / l : 0;
        d[o + P_VX] = px * f;
        d[o + P_VY] = py * f;
        d[o + P_VZ] = dz * f;
    }
}

function newSphereParticle(system, d, o) {
    // tbc: a point on an ellipse in the yz plane, moving outwards. A point on a sphere shell between the
    // two radii (length and width), within the vertical / horizontal range, moving outwards, up
    // (SphereUp flag) or away from zSource.
    var radius = system.areaLength + (system.areaWidth - system.areaLength) * frandPos();
    var polar = system.verticalRange * frand();
    var azimuth = system.horizontalRange * frand();
    var cosPolar = Math.cos(polar);
    var dirX = cosPolar * Math.cos(azimuth), dirY = cosPolar * Math.sin(azimuth), dirZ = Math.sin(polar);
    var px = dirX * radius, py = dirY * radius, pz = dirZ * radius;
    d[o + P_X] = px;
    d[o + P_Y] = py;
    d[o + P_Z] = pz;

    var mx, my, mz;
    if (Math.abs(system.zSource) < 1e-6) {
        if (system.hasFlag(ParticleFlags.SphereUp)) {
            mx = 0; my = 0; mz = 1;
        } else {
            mx = dirX; my = dirY; mz = dirZ;
        }
    } else {
        mx = px; my = py; mz = pz - system.zSource;
        var l = Math.sqrt(mx * mx + my * my + mz * mz);
        if (l > 1e-4) {
            mx /= l; my /= l; mz /= l;
        }
    }
    var speed = system.calcSpeed();
    d[o + P_VX] = mx * speed;
    d[o + P_VY] = my * speed;
    d[o + P_VZ] = mz * speed;
}

/* An animated value of an emitter (getTimedValue value type 4: the scalar as is, 2: an int16 / 32767,
 * 0: a vector3), or undefined. A global sequence the file does not have gives undefined instead of failing. */
export function emitterTimedValue(am, valueType, track,
                                  anim, time, length) {
    if (!track) return undefined;
    var globalSequences = am.m2File.globalSequences;
    if (track.global_sequence >= 0 && (!globalSequences || track.global_sequence >= globalSequences.length)) return undefined;
    var v = am.getTimedValue(valueType, time, length, anim, track);
    return v ? v : undefined;
}

function timedFloat(am, track, anim, time, length, defaultValue) {
    var v = emitterTimedValue(am, 4, track, anim, time, length);
    return v ? v[0] : defaultValue;
}

// Lifetime tracks (tbc's LifeRamp over three values): the key before t and the fraction to the next one
var keyIndex = 0;
var keyFraction = 0;
function locateKey(times, t) {
    keyIndex = 0;
    keyFraction = 0;
    var n = times.length;
    if (n == 0) return false;
    if (n == 1 || t <= times[0]) return true;
    if (t >= times[n - 1]) {
        keyIndex = n - 1;
        return true;
    }
    while (keyIndex < n - 2 && t >= times[keyIndex + 1]) keyIndex++;
    var span = times[keyIndex + 1] - times[keyIndex];
    keyFraction = span > 0 ? (t - times[keyIndex]) / span : 0;
    return true;
}

function interpFloat(track, t, defaultValue) {
    if (!locateKey(track.times, t)) return defaultValue;
    var a = track.values[keyIndex];
    return keyFraction > 0 ? a + (track.values[keyIndex + 1] - a) * keyFraction : a;
}

/* -1 without keys */
function interpCell(track, t) {
    if (!locateKey(track.times, t)) return -1;
    var a = track.values[keyIndex];
    return keyFraction > 0 ? Math.floor(a + (track.values[keyIndex + 1] - a) * keyFraction) : a;
}

/* A particle system of one M2 instance (tbc's ParticleSystem): updated with the instance's bones, and
 * turned into camera-facing quads by ParticleRenderer */
export default class ParticleEmitter {
    constructor(def) {
        this.def = def;
        this.generator = def.emitterType == 1 ? newPlaneParticle : def.emitterType == 2 ? newSphereParticle : null;

        this.particles = new Float64Array(PARTICLE_FLOATS * 16);
        this.count = 0;
        this.rem = 0;

        this.speed = 0;
        this.variation = 0;
        this.verticalRange = 0;
        this.horizontalRange = 0;
        this.gravity = 0;
        this.lifespan = 0;
        this.rate = 0;
        this.areaLength = 0;
        this.areaWidth = 0;
        this.zSource = 0;
        this.enabled = true;

        this.emitterMat = mat4.create();
        this.inheritedScale = 1;
        this.worldX = 0;
        this.worldY = 0;
        this.worldZ = 0;

        this.rows = Math.max(1, def.textureRows);
        this.cols = Math.max(1, def.textureCols);
        this.cellCount = this.rows * this.cols;
        this.startCell = this.hasFlag(ParticleFlags.RandomStartCell) ? Math.floor(Math.random() * this.cellCount) : 0;

        this.texture = null;
        this.wrapX = false;
        this.wrapY = false;
    }

    hasFlag(flag) {
        return (this.def.flags & flag) != 0;
    }

    calcSpeed() {
        return this.speed * (1 + this.variation * frand());
    }

    clear() {
        this.count = 0;
        this.rem = 0;
    }

    /* tbc's Setup and Update: evaluates the animated values for the model's animation, then spawns and
     * moves the particles. boneWorld is the placement times the emitter's bone matrix; dt in seconds. */
    update(dt, boneWorld, am, anim, time, length) {
        // tbc offset each system's animation time by a random fraction; the values follow the model's
        // animation here, as in the client, so timed bursts (spells) stay in step with the model
        var def = this.def;
        this.speed = timedFloat(am, def.emissionSpeed, anim, time, length, 0);
        this.variation = timedFloat(am, def.speedVariation, anim, time, length, 0);
        this.verticalRange = timedFloat(am, def.verticalRange, anim, time, length, 0);
        this.horizontalRange = timedFloat(am, def.horizontalRange, anim, time, length, 0);
        this.gravity = timedFloat(am, def.gravity, anim, time, length, 0);
        this.lifespan = timedFloat(am, def.lifespan, anim, time, length, 0);
        this.rate = timedFloat(am, def.emissionRate, anim, time, length, 0);
        this.areaLength = timedFloat(am, def.emissionAreaLength, anim, time, length, 0);
        this.areaWidth = timedFloat(am, def.emissionAreaWidth, anim, time, length, 0);
        this.zSource = timedFloat(am, def.zSource, anim, time, length, 0);
        this.enabled = timedFloat(am, def.enabledIn, anim, time, length, 1) != 0;

        var m = this.emitterMat;
        mat4.fromTranslation(m, [def.position.x, def.position.y, def.position.z]);
        mat4.multiply(m, boneWorld, m);
        this.worldX = m[12];
        this.worldY = m[13];
        this.worldZ = m[14];
        this.inheritedScale = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);

        if (dt <= 0) return;
        // a long frame (a hitch, or the emitter coming back into range) is simulated in steps
        dt = Math.min(dt, 1);
        while (dt > MAX_STEP) {
            this.step(MAX_STEP);
            dt -= MAX_STEP;
        }
        this.step(dt);
    }

    step(dt) {
        var d = this.particles;

        // age the particles and drop the dead ones (tbc removed them after moving, at rlife >= 1)
        var alive = 0;
        for (var i = 0; i < this.count; i++) {
            var o = i * PARTICLE_FLOATS;
            var life = d[o + P_LIFE] + dt;
            if (life >= d[o + P_MAX_LIFE]) continue;
            d[o + P_LIFE] = life;
            if (alive != i) d.copyWithin(alive * PARTICLE_FLOATS, o, o + PARTICLE_FLOATS);
            alive++;
        }
        this.count = alive;

        // spawn new particles: rate per second plus the remainder of the last step (tbc)
        if (this.generator && this.enabled) {
            var frate = this.rate + frand() * this.def.emissionRateVary;
            var ftospawn = dt * frate + this.rem;
            if (ftospawn < 1.0) {
                this.rem = Math.max(ftospawn, 0);
            } else {
                var tospawn = Math.floor(Math.min(ftospawn, MAX_PARTICLES));
                this.rem = ftospawn - tospawn;
                for (var i = 0; i < tospawn && this.count < MAX_PARTICLES; i++) {
                    if ((this.count + 1) * PARTICLE_FLOATS > d.length) {
                        var grown = new Float64Array(Math.min(d.length * 2, MAX_PARTICLES * PARTICLE_FLOATS));
                        grown.set(d);
                        this.particles = d = grown;
                    }
                    this.newParticle(this.count++ * PARTICLE_FLOATS, dt);
                }
            }
        }

        // move them: wind, gravity and drag (tbc: speed += down * gravity * dt, then pos += speed * exp(-drag * life) * dt)
        var gStep = -this.gravity * dt;
        var gPos = -this.gravity * 0.5 * dt * dt;
        var wind = this.def.windVector;
        var driftX = wind.x * dt, driftY = wind.y * dt, driftZ = wind.z * dt;
        var keep = 1 - Math.min(this.def.drag * dt, 1);
        var dieMovingOut = this.def.emitterType == 2 && this.hasFlag(ParticleFlags.DieMovingOut);
        var modelSpace = this.hasFlag(ParticleFlags.ModelSpace);

        alive = 0;
        for (var i = 0; i < this.count; i++) {
            var o = i * PARTICLE_FLOATS;
            var vx = d[o + P_VX] + driftX, vy = d[o + P_VY] + driftY, vz = d[o + P_VZ] + driftZ;
            var moveX = vx * dt, moveY = vy * dt, moveZ = vz * dt;
            vz += gStep;
            d[o + P_VX] = vx * keep;
            d[o + P_VY] = vy * keep;
            d[o + P_VZ] = vz * keep;
            var px = d[o + P_X] + moveX, py = d[o + P_Y] + moveY, pz = d[o + P_Z] + moveZ + gPos;
            d[o + P_X] = px;
            d[o + P_Y] = py;
            d[o + P_Z] = pz;

            // sphere emitters that pull particles in: they die once they move away from the centre
            if (dieMovingOut) {
                var cx = modelSpace ? px : px - this.worldX;
                var cy = modelSpace ? py : py - this.worldY;
                var cz = modelSpace ? pz : pz - this.worldZ;
                if (cx * moveX + cy * moveY + cz * moveZ > 0) continue;
            }
            if (alive != i) d.copyWithin(alive * PARTICLE_FLOATS, o, o + PARTICLE_FLOATS);
            alive++;
        }
        this.count = alive;
    }

    /* a new particle at offset o of the particle data */
    newParticle(o, dt) {
        var d = this.particles;
        this.generator(this, d, o);

        var maxLife = Math.max(this.lifespan + frand() * this.def.lifespanVary, 0.001);
        d[o + P_MAX_LIFE] = maxLife;
        // spread the particles of one step over its length, so they do not come out in clumps
        d[o + P_LIFE] = (dt * frandPos()) % maxLife;
        d[o + P_RAND_SCALE_X] = frand();
        d[o + P_RAND_SCALE_Y] = frand();
        d[o + P_RAND_BASE_SPIN] = frand();
        d[o + P_RAND_SPIN] = frand();
        d[o + P_SEED] = Math.floor(Math.random() * 0x10000);
        // tbc: always a random tile; the client uses the head cell track, and a random cell only with this flag
        d[o + P_CELL] = Math.floor(Math.random() * this.cellCount);

        if (!this.hasFlag(ParticleFlags.ModelSpace)) {
            var m = this.emitterMat;
            var x = d[o + P_X], y = d[o + P_Y], z = d[o + P_Z];
            d[o + P_X] = m[0] * x + m[4] * y + m[8] * z + m[12];
            d[o + P_Y] = m[1] * x + m[5] * y + m[9] * z + m[13];
            d[o + P_Z] = m[2] * x + m[6] * y + m[10] * z + m[14];
            x = d[o + P_VX]; y = d[o + P_VY]; z = d[o + P_VZ];
            d[o + P_VX] = m[0] * x + m[4] * y + m[8] * z;
            d[o + P_VY] = m[1] * x + m[5] * y + m[9] * z;
            d[o + P_VZ] = m[2] * x + m[6] * y + m[10] * z;
        }
    }

    /* the spin of the particle at offset o of the particle data */
    spinAngle(o) {
        var d = this.particles;
        var def = this.def;
        var baseSpin = def.baseSpin + d[o + P_RAND_BASE_SPIN] * def.baseSpinVary;
        var spin = def.spin + d[o + P_RAND_SPIN] * def.spinVary;
        var theta = baseSpin + spin * d[o + P_LIFE];
        if (this.hasFlag(ParticleFlags.RandomFlipSpin) && (d[o + P_SEED] & 1) != 0) theta = -theta;
        return theta;
    }

    /* tbc's Draw: adds the quads of the live particles to the renderer's current batch, in world space.
     * The quad is 2 * scale wide (tbc: sqrt(2) * size), billboarded unless NotBillboarded (then flat in the
     * world's xy plane, or the emitter's for ModelSpace); the head quad sits on the particle, the tail quad
     * trails behind it along its speed (tbc's particle type 1, "from origin to position").
     * right and up are the camera's axes in world space. */
    addQuads(renderer, right, up) {
        var head = this.hasFlag(ParticleFlags.Head);
        var tail = this.hasFlag(ParticleFlags.Tail);
        if (this.count == 0 || (!head && !tail)) return;

        var def = this.def;
        var modelSpace = this.hasFlag(ParticleFlags.ModelSpace);
        var notBillboarded = this.hasFlag(ParticleFlags.NotBillboarded);
        var velocityOriented = this.hasFlag(ParticleFlags.VelocityOriented);
        var scaleVaryXY = this.hasFlag(ParticleFlags.ScaleVaryXY);
        var inheritScale = this.hasFlag(ParticleFlags.InheritScale);
        var randomCell = this.hasFlag(ParticleFlags.RandomCell);
        var tailUpToAge = this.hasFlag(ParticleFlags.TailUpToAge);
        var hasSpin = def.spin != 0 || def.spinVary != 0;
        var maxLife = Math.max(this.lifespan + def.lifespanVary, 0.001);
        var twinkleVary = def.twinkleScaleMax - def.twinkleScaleMin;
        var twinkles = def.twinklePercent < 1 || twinkleVary != 0;
        var rx = right[0], ry = right[1], rz = right[2];
        var ux = up[0], uy = up[1], uz = up[2];

        // the quad axes of flat particles: the world's x and y, or the emitter's without its scale
        var m = this.emitterMat;
        var qxx = 1, qxy = 0, qxz = 0, qyx = 0, qyy = 1, qyz = 0, qzx = 0, qzy = 0, qzz = 1;
        if (modelSpace) {
            var s = this.inheritedScale > 0 ? 1 / this.inheritedScale : 1;
            qxx = m[0] * s; qxy = m[1] * s; qxz = m[2] * s;
            qyx = m[4] * s; qyy = m[5] * s; qyz = m[6] * s;
            qzx = m[8] * s; qzy = m[9] * s; qzz = m[10] * s;
        }

        var colorTrack = def.colorTrack;
        var scaleTrack = def.scaleTrack;

        var d = this.particles;
        for (var i = 0; i < this.count; i++) {
            var o = i * PARTICLE_FLOATS;
            var life = d[o + P_LIFE];

            // twinkle: hidden for some time slices, and scaled
            var twinkleWeight = 1;
            if (twinkles) {
                var rnd = randTable[0x7f & (Math.floor(life * def.twinkleSpeed) + d[o + P_SEED])];
                if (def.twinklePercent < rnd) continue;
                twinkleWeight = def.twinkleScaleMin + twinkleVary * rnd;
            }

            var lifeFrac = Math.min(Math.max(life / maxLife, 0), 1);
            var alpha = interpFloat(def.alphaTrack, lifeFrac, 1);
            if (alpha <= 0) continue;

            var cr = 1, cg = 1, cb = 1;
            if (locateKey(colorTrack.times, lifeFrac)) {
                var c0 = colorTrack.values[keyIndex];
                cr = c0.x; cg = c0.y; cb = c0.z;
                if (keyFraction > 0) {
                    var c1 = colorTrack.values[keyIndex + 1];
                    cr += (c1.x - cr) * keyFraction;
                    cg += (c1.y - cg) * keyFraction;
                    cb += (c1.z - cb) * keyFraction;
                }
            }

            var sx = 1, sy = 1;
            if (locateKey(scaleTrack.times, lifeFrac)) {
                var s0 = scaleTrack.values[keyIndex];
                sx = s0.x; sy = s0.y;
                if (keyFraction > 0) {
                    var s1 = scaleTrack.values[keyIndex + 1];
                    sx += (s1.x - sx) * keyFraction;
                    sy += (s1.y - sy) * keyFraction;
                }
            }
            if (scaleVaryXY) {
                sx *= Math.max(1 + d[o + P_RAND_SCALE_X] * def.scaleVary.x, 0.0001);
                sy *= Math.max(1 + d[o + P_RAND_SCALE_Y] * def.scaleVary.y, 0.0001);
            } else {
                var vary = Math.max(1 + d[o + P_RAND_SCALE_X] * def.scaleVary.x, 0.0001);
                sx *= vary;
                sy *= vary;
            }
            sx *= twinkleWeight;
            sy *= twinkleWeight;
            if (inheritScale) {
                sx *= this.inheritedScale;
                sy *= this.inheritedScale;
            }

            // the centre and the speed in world space
            // (the speed in particle space too, for the flat quads)
            var lvx = d[o + P_VX], lvy = d[o + P_VY], lvz = d[o + P_VZ];
            var px = d[o + P_X], py = d[o + P_Y], pz = d[o + P_Z];
            var vx = lvx, vy = lvy, vz = lvz;
            if (modelSpace) {
                var lx = px, ly = py, lz = pz;
                px = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
                py = m[1] * lx + m[5] * ly + m[9] * lz + m[13];
                pz = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
                vx = m[0] * lvx + m[4] * lvy + m[8] * lvz;
                vy = m[1] * lvx + m[5] * lvy + m[9] * lvz;
                vz = m[2] * lvx + m[6] * lvy + m[10] * lvz;
            }

            if (head) {
                var m0x, m0y, m0z, m1x, m1y, m1z;
                var moving = velocityOriented && (lvx * lvx + lvy * lvy + lvz * lvz) > 2.4e-7;
                if (notBillboarded) {
                    var axx = qxx, axy = qxy, axz = qxz, ayx = qyx, ayy = qyy, ayz = qyz;
                    if (moving) {
                        // turned in the plane to point against the speed
                        var dx = -lvx, dy = -lvy;
                        var dl = Math.sqrt(dx * dx + dy * dy);
                        if (dl > 1e-6) {
                            dx /= dl; dy /= dl;
                            axx = qxx * dx + qyx * dy; axy = qxy * dx + qyy * dy; axz = qxz * dx + qyz * dy;
                            ayx = qyx * dx - qxx * dy; ayy = qyy * dx - qxy * dy; ayz = qyz * dx - qxz * dy;
                        }
                    }
                    m0x = axx * sx; m0y = axy * sx; m0z = axz * sx;
                    m1x = ayx * sy; m1y = ayy * sy; m1z = ayz * sy;
                    if (hasSpin) {
                        // rotated in the plane around its normal: v * cos + (z x v) * sin
                        var theta = this.spinAngle(o);
                        var c = Math.cos(theta), sn = Math.sin(theta);
                        var t0x = m0x * c + (qzy * m0z - qzz * m0y) * sn;
                        var t0y = m0y * c + (qzz * m0x - qzx * m0z) * sn;
                        var t0z = m0z * c + (qzx * m0y - qzy * m0x) * sn;
                        var t1x = m1x * c + (qzy * m1z - qzz * m1y) * sn;
                        var t1y = m1y * c + (qzz * m1x - qzx * m1z) * sn;
                        var t1z = m1z * c + (qzx * m1y - qzy * m1x) * sn;
                        m0x = t0x; m0y = t0y; m0z = t0z;
                        m1x = t1x; m1y = t1y; m1z = t1z;
                    }
                } else if (moving) {
                    // billboard stretched along the speed
                    var vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
                    var nx = -vx / vl, ny = -vy / vl, nz = -vz / vl;
                    var nr = nx * rx + ny * ry + nz * rz, nu = nx * ux + ny * uy + nz * uz;
                    m0x = nx * sx; m0y = ny * sx; m0z = nz * sx;
                    m1x = (rx * nu - ux * nr) * sy; m1y = (ry * nu - uy * nr) * sy; m1z = (rz * nu - uz * nr) * sy;
                } else if (hasSpin) {
                    var theta = this.spinAngle(o);
                    var c = Math.cos(theta), sn = Math.sin(theta);
                    m0x = (rx * c + ux * sn) * sx; m0y = (ry * c + uy * sn) * sx; m0z = (rz * c + uz * sn) * sx;
                    m1x = (ux * c - rx * sn) * sy; m1y = (uy * c - ry * sn) * sy; m1z = (uz * c - rz * sn) * sy;
                } else {
                    m0x = rx * sx; m0y = ry * sx; m0z = rz * sx;
                    m1x = ux * sy; m1y = uy * sy; m1z = uz * sy;
                }

                var cell = interpCell(def.headCellTrack, lifeFrac);
                if (cell < 0) cell = randomCell ? d[o + P_CELL] : 0;
                renderer.addParticleQuad(px, py, pz, m0x, m0y, m0z, m1x, m1y, m1z, cr, cg, cb, alpha,
                    (cell + this.startCell) % this.cellCount, this.cols, this.rows);
            }

            if (tail) {
                var trailTime = def.tailLength;
                if (tailUpToAge) trailTime = Math.min(life, trailTime);
                var trx = -vx * trailTime, try_ = -vy * trailTime, trz = -vz * trailTime;
                var tx = trx * rx + try_ * ry + trz * rz, ty = trx * ux + try_ * uy + trz * uz;
                var l2 = tx * tx + ty * ty;
                var tcx = px, tcy = py, tcz = pz;
                var t0x, t0y, t0z, t1x, t1y, t1z;
                if (l2 > 1e-4) {
                    // from the particle back along its speed, as wide as its scale across the screen
                    var tl = Math.sqrt(l2);
                    var tnx = tx / tl, tny = ty / tl;
                    t0x = trx * 0.5; t0y = try_ * 0.5; t0z = trz * 0.5;
                    t1x = -rx * tny * sy + ux * tnx * sx;
                    t1y = -ry * tny * sy + uy * tnx * sx;
                    t1z = -rz * tny * sy + uz * tnx * sx;
                    tcx += t0x; tcy += t0y; tcz += t0z;
                } else {
                    t0x = rx * sx * 0.05; t0y = ry * sx * 0.05; t0z = rz * sx * 0.05;
                    t1x = ux * sy * 0.05; t1y = uy * sy * 0.05; t1z = uz * sy * 0.05;
                }

                var tailCell = Math.max(interpCell(def.tailCellTrack, lifeFrac), 0);
                renderer.addParticleQuad(tcx, tcy, tcz, t0x, t0y, t0z, t1x, t1y, t1z, cr, cg, cb, alpha,
                    (tailCell + this.startCell) % this.cellCount, this.cols, this.rows);
            }
        }
    }
}
