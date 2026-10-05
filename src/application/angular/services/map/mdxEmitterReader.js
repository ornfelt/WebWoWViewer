const PARTICLE_SIZE_WOTLK = 476;
const PARTICLE_SIZE_OLD = 504;
const RIBBON_SIZE_WOTLK = 176;
const RIBBON_SIZE_OLD = 220;
/* more than any client model has; a larger count means a broken header */
const MAX_EMITTERS = 512;

/* the head / tail flags WotLK uses where older versions have the particle type */
const FLAG_HEAD = 0x20000;
const FLAG_TAIL = 0x40000;

function isWotlk(version) {
    return version >= 264;
}

function inFile(reader, offset, count, elementSize) {
    return count >= 0 && offset >= 0 && offset + count * elementSize <= reader.getLength();
}

function readValue(r, o, type) {
    switch (type) {
        case "float32": return r.readFloat32(o);
        case "vector3f": return r.readVector3f(o);
        case "int16": return r.readInt16(o);
        case "uint16": return r.readUint16(o);
        case "uint8": return r.readUint8(o);
    }
}

function valueSize(type) {
    switch (type) {
        case "float32": return 4;
        case "vector3f": return 12;
        case "int16": return 2;
        case "uint16": return 2;
        case "uint8": return 1;
    }
}

/* An M2Track: 20 bytes in WotLK, 28 before (with the interpolation ranges) */
function readTrack(r, version, o, valueType) {
    var track = {
        interpolation_type: r.readUint16(o),
        global_sequence: r.readInt16(o),
        timestampsPerAnimation: [],
        valuesPerAnimation: []
    };
    var size = valueSize(valueType);

    if (isWotlk(version)) {
        var timesCnt = r.readInt32(o);
        var timesOfs = r.readInt32(o);
        var valuesCnt = r.readInt32(o);
        var valuesOfs = r.readInt32(o);
        if (!inFile(r, timesOfs, timesCnt, 8) || !inFile(r, valuesOfs, valuesCnt, 8))
            return track;

        var timesHeader = {offs: timesOfs};
        var valuesHeader = {offs: valuesOfs};
        var animCnt = Math.min(timesCnt, valuesCnt);
        for (var a = 0; a < animCnt; a++) {
            var tCnt = r.readInt32(timesHeader);
            var tOfs = r.readInt32(timesHeader);
            var vCnt = r.readInt32(valuesHeader);
            var vOfs = r.readInt32(valuesHeader);

            var times = [];
            var values = [];
            // keys of an animation kept in an .anim file point outside the .m2: leave that animation empty
            if (tCnt == vCnt && tCnt > 0 && inFile(r, tOfs, tCnt, 4) && inFile(r, vOfs, vCnt, size)) {
                var to = {offs: tOfs};
                var vo = {offs: vOfs};
                for (var k = 0; k < tCnt; k++) {
                    times.push(r.readUint32(to));
                    values.push(readValue(r, vo, valueType));
                }
            }
            track.timestampsPerAnimation.push(times);
            track.valuesPerAnimation.push(values);
        }
    } else {
        o.offs += 8; // interpolation ranges: the keys of all animations are in one list with absolute times
        var timesCnt = r.readInt32(o);
        var timesOfs = r.readInt32(o);
        var valuesCnt = r.readInt32(o);
        var valuesOfs = r.readInt32(o);

        var times = [];
        var values = [];
        if (timesCnt == valuesCnt && timesCnt > 0 && inFile(r, timesOfs, timesCnt, 4) && inFile(r, valuesOfs, valuesCnt, size)) {
            var to = {offs: timesOfs};
            var vo = {offs: valuesOfs};
            for (var k = 0; k < timesCnt; k++) {
                times.push(r.readUint32(to));
                values.push(readValue(r, vo, valueType));
            }
        }
        track.timestampsPerAnimation.push(times);
        track.valuesPerAnimation.push(values);
    }

    return track;
}

/* A WotLK FBlock: fixed16 times (fractions of the lifetime) and values */
function readPartTrack(r, o, valueSize, readOneValue) {
    var timesCnt = r.readInt32(o);
    var timesOfs = r.readInt32(o);
    var valuesCnt = r.readInt32(o);
    var valuesOfs = r.readInt32(o);

    var track = {times: [], values: []};
    var cnt = Math.min(timesCnt, valuesCnt);
    if (cnt <= 0 || !inFile(r, timesOfs, cnt, 2) || !inFile(r, valuesOfs, cnt, valueSize))
        return track;

    var to = {offs: timesOfs};
    var vo = {offs: valuesOfs};
    for (var k = 0; k < cnt; k++) {
        track.times.push(r.readUint16(to) / 32767);
        track.values.push(readOneValue(vo));
    }
    return track;
}

/* An M2Array of uint16 (count, offset); empty when it lies outside the file */
function readUint16Array(r, o) {
    var count = r.readInt32(o);
    var offset = r.readInt32(o);
    if (count <= 0 || !inFile(r, offset, count, 2)) return [];
    return r.readUint16Array({offs: offset}, count);
}

/* Before WotLK: a mid point, three ARGB colours, three sizes and the cell animations
 * ({start, end, repeat} up to and after the mid point, {start, end} of the tail twice), turned into
 * the WotLK tracks the same way WotLK converted these models (keys at 0, mid and 1; the head and
 * tail cells jump from the first range to the second at mid). */
function readOldLifetimeValues(r, o, p) {
    var mid = Math.min(Math.max(r.readFloat32(o), 0), 1);
    var argb = [r.readUint32(o), r.readUint32(o), r.readUint32(o)];
    var sizes = [r.readFloat32(o), r.readFloat32(o), r.readFloat32(o)];
    var cells = r.readInt16Array(o, 10);

    var times3 = [0, mid, 1];
    p.colorTrack = {
        times: times3,
        values: argb.map((c) => ({x: ((c >>> 16) & 0xFF) / 255, y: ((c >>> 8) & 0xFF) / 255, z: (c & 0xFF) / 255}))
    };
    p.alphaTrack = {
        times: times3,
        values: argb.map((c) => ((c >>> 24) & 0xFF) / 255)
    };
    p.scaleTrack = {
        times: times3,
        values: sizes.map((s) => ({x: s, y: s}))
    };

    var times4 = [0, mid, mid, 1];
    p.headCellTrack = {
        times: times4,
        values: [cells[0] & 0xFFFF, cells[1] & 0xFFFF, cells[3] & 0xFFFF, cells[4] & 0xFFFF]
    };
    p.tailCellTrack = {
        times: times4,
        values: [cells[6] & 0xFFFF, cells[7] & 0xFFFF, cells[8] & 0xFFFF, cells[9] & 0xFFFF]
    };
}

function readParticle(r, version, o) {
    var wotlk = isWotlk(version);
    var p = {};
    p.id = r.readInt32(o);
    p.flags = r.readUint32(o);
    p.position = r.readVector3f(o);
    p.bone = r.readUint16(o);
    p.texture = r.readUint16(o);
    o.offs += 16; // geometry and recursion model file names

    if (version >= 262) {
        p.blendingType = r.readUint8(o);
        p.emitterType = r.readUint8(o);
        p.particleColorIndex = r.readUint16(o);
    } else {
        // 256-261: both are uint16
        p.blendingType = r.readUint16(o) & 0xFF;
        p.emitterType = r.readUint16(o) & 0xFF;
        p.particleColorIndex = 0;
    }
    p.particleType = r.readUint8(o);
    p.headOrTail = r.readUint8(o);
    p.textureTileRotation = r.readInt16(o);
    p.textureRows = r.readUint16(o);
    p.textureCols = r.readUint16(o);

    p.emissionSpeed = readTrack(r, version, o, "float32");
    p.speedVariation = readTrack(r, version, o, "float32");
    p.verticalRange = readTrack(r, version, o, "float32");
    p.horizontalRange = readTrack(r, version, o, "float32");
    p.gravity = readTrack(r, version, o, "float32");
    p.lifespan = readTrack(r, version, o, "float32");
    p.lifespanVary = wotlk ? r.readFloat32(o) : 0;
    p.emissionRate = readTrack(r, version, o, "float32");
    p.emissionRateVary = wotlk ? r.readFloat32(o) : 0;
    p.emissionAreaLength = readTrack(r, version, o, "float32");
    p.emissionAreaWidth = readTrack(r, version, o, "float32");
    p.zSource = readTrack(r, version, o, "float32");

    if (wotlk) {
        p.colorTrack = readPartTrack(r, o, 12, (off) => {
            var c = r.readVector3f(off);
            return {x: c.x / 255, y: c.y / 255, z: c.z / 255};
        });
        p.alphaTrack = readPartTrack(r, o, 2, (off) => r.readInt16(off) / 32767);
        p.scaleTrack = readPartTrack(r, o, 8, (off) => r.readVector2f(off));
        p.scaleVary = r.readVector2f(o);
        p.headCellTrack = readPartTrack(r, o, 2, (off) => r.readUint16(off));
        p.tailCellTrack = readPartTrack(r, o, 2, (off) => r.readUint16(off));
    } else {
        readOldLifetimeValues(r, o, p);
        p.scaleVary = {x: 0, y: 0};
    }

    p.tailLength = r.readFloat32(o);
    p.twinkleSpeed = r.readFloat32(o);
    p.twinklePercent = r.readFloat32(o);
    p.twinkleScaleMin = r.readFloat32(o);
    p.twinkleScaleMax = r.readFloat32(o);
    p.burstMultiplier = r.readFloat32(o);
    p.drag = r.readFloat32(o);
    if (wotlk) {
        p.baseSpin = r.readFloat32(o);
        p.baseSpinVary = r.readFloat32(o);
        p.spin = r.readFloat32(o);
        p.spinVary = r.readFloat32(o);
    } else {
        // tbc's "rotation": the WotLK versions of the same models have it as spin
        p.baseSpin = 0;
        p.baseSpinVary = 0;
        p.spin = r.readFloat32(o);
        p.spinVary = 0;
    }
    o.offs += 24; // tumble
    p.windVector = r.readVector3f(o);
    p.windTime = r.readFloat32(o);
    o.offs += 16; // follow speed / scale 1 and 2
    o.offs += 8;  // spline points
    p.enabledIn = readTrack(r, version, o, "uint8");

    if (!wotlk) {
        // the WotLK versions of the same models have the head flag for type 0 and the tail flag for type 1
        p.flags &= ~(FLAG_HEAD | FLAG_TAIL);
        if (p.particleType == 0 || p.particleType == 2) p.flags |= FLAG_HEAD;
        if (p.particleType == 1 || p.particleType == 2) p.flags |= FLAG_TAIL;
        p.flags >>>= 0;
    }

    return p;
}

function readParticles(r, version, m2File) {
    var count = m2File.nParticleEmitters;
    var size = isWotlk(version) ? PARTICLE_SIZE_WOTLK : PARTICLE_SIZE_OLD;
    var result = [];
    if (!(count > 0)) return result;
    if (count > MAX_EMITTERS || !inFile(r, m2File.ofsParticleEmitters, count, size))
        throw "bad particle emitter array (" + count + " at " + m2File.ofsParticleEmitters + ")";

    for (var i = 0; i < count; i++) {
        result.push(readParticle(r, version, {offs: m2File.ofsParticleEmitters + i * size}));
    }
    return result;
}

function readRibbons(r, version, m2File) {
    var count = m2File.nRibbonEmitters;
    var size = isWotlk(version) ? RIBBON_SIZE_WOTLK : RIBBON_SIZE_OLD;
    var result = [];
    if (!(count > 0)) return result;
    if (count > MAX_EMITTERS || !inFile(r, m2File.ofsRibbonEmitters, count, size))
        throw "bad ribbon emitter array (" + count + " at " + m2File.ofsRibbonEmitters + ")";

    for (var i = 0; i < count; i++) {
        var o = {offs: m2File.ofsRibbonEmitters + i * size};
        var rib = {};
        rib.id = r.readInt32(o);
        rib.bone = r.readInt32(o);
        rib.position = r.readVector3f(o);
        rib.textureIndices = readUint16Array(r, o);
        rib.materialIndices = readUint16Array(r, o);
        rib.color = readTrack(r, version, o, "vector3f");
        rib.alpha = readTrack(r, version, o, "int16");
        rib.heightAbove = readTrack(r, version, o, "float32");
        rib.heightBelow = readTrack(r, version, o, "float32");
        rib.edgesPerSecond = r.readFloat32(o);
        rib.edgeLifetime = r.readFloat32(o);
        rib.gravity = r.readFloat32(o);
        rib.textureRows = r.readUint16(o);
        rib.textureCols = r.readUint16(o);
        readTrack(r, version, o, "uint16"); // texture slot
        rib.visibility = readTrack(r, version, o, "uint8");
        result.push(rib);
    }
    return result;
}

/* Reads the particle and ribbon emitters of an MD20 file, classic (256) to WotLK (264), into
 * m2File.particleEmitters / ribbonEmitters (my_web_wow's M2EmitterReader).
 *
 * Not a layout table: the structs differ by version in ways the layouts can not express (the 256-261
 * blend / emitter type packing, the WotLK lifetime tracks versus tbc's three values and mid point),
 * and a track whose data lies outside the file (in an .anim file) has to be read as empty instead of
 * failing the whole model. The tracks come out in the same shape as "ablock" (WotLK) and "ablock_tbc"
 * (older: every animation in one slot, absolute times), so AnimationManager.getTimedValue evaluates
 * them like the other tracks. A broken emitter array drops only the emitters. */
export default function readM2Emitters(reader, version, m2File) {
    try {
        m2File.particleEmitters = readParticles(reader, version, m2File);
    } catch (e) {
        console.log("Particle emitters of " + m2File.fileName + " not read: " + e);
        m2File.particleEmitters = [];
    }
    try {
        m2File.ribbonEmitters = readRibbons(reader, version, m2File);
    } catch (e) {
        console.log("Ribbon emitters of " + m2File.fileName + " not read: " + e);
        m2File.ribbonEmitters = [];
    }
}
