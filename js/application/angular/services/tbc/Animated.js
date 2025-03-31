import { interpolate, interpolateHermite } from "./Interpolation.js";
import { Interpolations } from "./Interpolations.js";
import Quaternion from "./quaternion.js";
import Vec3D from "./vec3d.js";

//export class Animated {
class Animated {
  /**
   * @param {string} converterName A string defining the converter to use (e.g. "convertToQuaternion", "convertToVec3D").
   */
  constructor(converterName) {
    this.globalTime = 0;
    this.used = false;
    this.type = 0;      // Will hold an integer (e.g., from Interpolations)
    this.seq = -1;      // Sequence index; -1 if not used.
    this.globals = [];
    this.ranges = [];   // Array of objects: { first, second }
    this.times = [];
    this.data = [];
    this.in = [];
    this.out = [];
    this._converter = Animated.getConverter(converterName);
    //console.log("this._converter:", this._converter);
  }

  static getConverter(name) {
    switch(name) {
      case "convertToQuaternion":
        return Animated.convertToQuaternion;
      case "convertToVec3D":
        return Animated.convertToVec3D;
      case "convertShortToFloat":
        return Animated.convertShortToFloat;
      case "convertToFloat":
        return Animated.convertToFloat;
      default:
        return Animated.convertRaw;
    }
  }

  // This won't really be used
  static convertToQuaternion(raw) {
      if (raw instanceof Quaternion) {
          return raw;
      }
      if (Array.isArray(raw)) {
          if (raw.length >= 4) {
              return new Quaternion(raw[0], raw[1], raw[2], raw[3]);
          } else if (raw.length === 3) {
              return new Quaternion(raw[0], raw[1], raw[2], 1.0);
          }
      }
      if (typeof raw === "number") {
          return new Quaternion(raw, raw, raw, raw);
      }

      // Fallback
      return new Quaternion(0, 0, 0, 0);
  }

  static convertRaw(raw) {
    return raw;
  }

  static convertShortToFloat(raw) {
    return Number(raw / 32767.0);
  }

  static convertToFloat(raw) {
    return Number(raw);
  }

  static convertToVec3D(raw) {
      // If raw is already a Vec3D, just return it.
      if (raw instanceof Vec3D) {
          return raw;
      }

      // For user code that might pass numeric array [x,y,z]
      if (Array.isArray(raw) && raw.length >= 3) {
          return new Vec3D(raw[0], raw[1], raw[2]);
      }

      // If it's a single number, treat that as X=Y=Z
      if (typeof raw === "number") {
          return new Vec3D(raw, raw, raw);
      }

      // If you have a short -> float converter:
      if (typeof raw === "number" && Number.isInteger(raw)) {
          const scaledValue = shortToFloat(raw); 
          return new Vec3D(scaledValue, scaledValue, scaledValue);
      }

      // Fallback
      return new Vec3D(0, 0, 0);
  }

  getValue(anim, time) {
    //console.log("getValue() called");
    //console.log("Input anim:", anim, "Input time:", time);
    //console.log("Interpolation type:", this.type);

    if (this.type !== Interpolations.None) {
      let range;
      if (this.seq !== -1) {
        time = this.globals[this.seq] === 0 ? 0 : this.globalTime % this.globals[this.seq];
        range = { first: 0, second: this.data.length - 1 };
        //console.log("Using global sequence. New time:", time, "Range:", range);
      } else {
        range = this.ranges[anim];
        time %= this.times[this.times.length - 1];
        //console.log("Using local range. Range:", range, "Time after modulus:", time);
      }
      if (range.first !== range.second) {
        let pos = range.first;
        for (let i = range.first; i < range.second; i++) {
          if (time >= this.times[i] && time < this.times[i + 1]) {
            pos = i;
            //console.log("Found keyframe position:", pos, "with times:", this.times[i], "and", this.times[i + 1]);
            break;
          }
        }
        const t1 = this.times[pos];
        const t2 = this.times[pos + 1];
        const r = (time - t1) / (t2 - t1);
        //console.log("Interpolation parameters: t1 =", t1, "t2 =", t2, "r =", r);

        let result;
        // Check converter name instead of using instanceof
        if (this._converter.name === "convertToQuaternion") {
          if (this.type === Interpolations.Linear) {
            result = Quaternion.slerp(this.data[pos], this.data[pos + 1], r);
            //console.log("Quaternion linear interpolation (slerp) result:", result);
          } else {
            // Never happens...
            result = interpolateHermiteQuaternion(r, this.data[pos], this.data[pos + 1], this.in[pos], this.out[pos]);
            //console.log("Quaternion Hermite interpolation result:", result);
          }
        } else {
          if (this.type === Interpolations.Linear) {
            result = interpolate(r, this.data[pos], this.data[pos + 1]);
            //console.log("Numeric linear interpolation result:", result);
          } else {
            result = interpolateHermite(r, this.data[pos], this.data[pos + 1], this.in[pos], this.out[pos]);
            //console.log("Numeric Hermite interpolation result:", result);
          }
        }
        return result;
      } else {
        //console.log("Range has a single keyframe. Returning value:", this.data[range.first]);
        return this.data[range.first];
      }
    } else {
      return this.data[0];
    }
  }

  /**
   * Initializes the animated data from the provided animation block.
   * @param {Object} b - The AnimationBlock (with properties: type, seq, interpolation_ranges_nb, ofsRanges, timestamps_nb, ofsTimes, values_nb, ofsValues).
   * @param {BinaryParser} parser - A BinaryParser instance positioned at the beginning of the file.
   * @param {number[]} globalSequences - An array of global sequence times.
   * @param {boolean} isFloat - If true, keyframe values are floats.
   */
  init(b, parser, globalSequences, isFloat = false) {
    this.globals = globalSequences;
    this.type = b.interpolation_type;
    this.seq = b.seqglobal_sequence;
    if (this.seq !== -1 && !globalSequences) {
      throw new Error("Global sequences required");
    }
    this.used = this.type !== Interpolations.None;

    // Load ranges.
    if (b.interpolation_ranges_nb > 0) {
      parser.moveTo(b.ofsRanges);
      for (let i = 0; i < b.interpolation_ranges_nb; i++) {
        // Assume parser.readM2Range() returns an object { minimum, maximum }.
        const range = parser.readM2Range();
        this.ranges.push({ first: range.minimum, second: range.maximum });
      }
    } else if (this.type !== 0 && this.seq === -1) {
      this.ranges.push({ first: 0, second: b.values_nb - 1 });
    }

    // Load times.
    if (b.timestamps_nb === b.values_nb) {
      parser.moveTo(b.ofsTimes);
      for (let i = 0; i < b.timestamps_nb; i++) {
        const time = parser.readInt32();
        this.times.push(time);
      }
    }

    // Load keyframes.
    parser.moveTo(b.ofsValues);
    switch (this.type) {
      case Interpolations.None:
      case Interpolations.Linear:
        for (let i = 0; i < b.values_nb; i++) {
          if (this._converter.name === "convertToVec3D") {
            const key = parser.readVec3D();
            this.data.push(this._converter(key));
          } else if (this._converter.name === "convertToQuaternion") {
            if (window.selectedExpansion === "tbc") {
                // Read 4 shorts (8 bytes) for Quaternion.
                const sx = parser.readInt16();
                const sy = parser.readInt16();
                const sz = parser.readInt16();
                const sw = parser.readInt16();
                const x = (sx < 0 ? sx + 32768 : sx - 32767) / 32767;
                const y = (sy < 0 ? sy + 32768 : sy - 32767) / 32767;
                const z = (sz < 0 ? sz + 32768 : sz - 32767) / 32767;
                const w = (sw < 0 ? sw + 32768 : sw - 32767) / 32767;
                const key = new Quaternion(x, y, z, w);
                this.data.push(this._converter(key));
            } else {
                /// Read 4 floats (16 bytes) for Quaternion.
                const x = parser.readFloat32();
                const y = parser.readFloat32();
                const z = parser.readFloat32();
                const w = parser.readFloat32();
                const key = new Quaternion(x, y, z, w);
                this.data.push(this._converter(key));
            }
          } else if (isFloat) {
            const key = parser.readFloat32();
            this.data.push(this._converter(key));
          } else {
            const key = parser.readInt16();
            this.data.push(this._converter(key));
          }
        }
        break;
      case Interpolations.Hermite:
        for (let i = 0; i < b.values_nb; i++) {
          const key = parser.readInt16();
          this.data.push(this._converter(key));
          const inTangent = parser.readInt16();
          const outTangent = parser.readInt16();
          this.in.push(this._converter(inTangent));
          this.out.push(this._converter(outTangent));
        }
        break;
    }
  }

  /**
   * Applies a fix function to all keyframe data (and in/out tangents, if Hermite).
   * @param {Function} fixFunc A function that takes a value of type T and returns a fixed value.
   */
  fix(fixFunc) {
    switch (this.type) {
      case Interpolations.None:
      case Interpolations.Linear:
        for (let i = 0; i < this.data.length; i++) {
          this.data[i] = fixFunc(this.data[i]);
        }
        break;
      case Interpolations.Hermite:
        for (let i = 0; i < this.data.length; i++) {
          this.data[i] = fixFunc(this.data[i]);
          this.in[i] = fixFunc(this.in[i]);
          this.out[i] = fixFunc(this.out[i]);
        }
        break;
    }
  }

    // Verbose will include all data, usage:
    // console.log(anim.toString(true));
    toString(verbose = false) {
        const dataStr = verbose
            ? this.data.map(d => d.toString()).join(', ')
            : this.data.slice(0, 5).map(d => d.toString()).join(', ') + (this.data.length > 5 ? ', ...' : '');
        const timesStr = verbose
            ? this.times.join(', ')
            : this.times.slice(0, 5).join(', ') + (this.times.length > 5 ? ', ...' : '');
            
        return `Animated {
            type: ${this.type},
            seq: ${this.seq},
            used: ${this.used},
            globals: [${this.globals.join(', ')}],
            ranges: [${this.ranges.map(r => `[${r.first}, ${r.second}]`).join(', ')}],
            times: [${timesStr}],
            data: [${dataStr}]
        }`;
    }
}

export default Animated;

