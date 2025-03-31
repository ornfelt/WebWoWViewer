//const { Vec4D } = require('./vec4d');
//const { Vec3D } = require('./vec3d');
import Vec3D from './vec3d.js';
import Vec4D from './vec4d.js';

class Quaternion extends Vec4D {
  /**
   * Creates a Quaternion
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} w (default: 1.0)
   */
  constructor(x = 0.0, y = 0.0, z = 0.0, w = 1.0) {
    super(x, y, z, w);
  }

  /**
   * Create a Quaternion from a Vec4D.
   * @param {Vec4D} v
   * @returns {Quaternion}
   */
  static fromVec4D(v) {
    return new Quaternion(v.x, v.y, v.z, v.w);
  }

  /**
   * Create a Quaternion from a Vec3D and a w component.
   * @param {Vec3D} v
   * @param {number} w
   * @returns {Quaternion}
   */
  static fromVec3D(v, w) {
    return new Quaternion(v.x, v.y, v.z, w);
  }

  /**
   * Spherical Linear Interpolation (SLERP) between two quaternions.
   * @param {number} r - Interpolation factor (0 to 1)
   * @param {Quaternion} v1
   * @param {Quaternion} v2
   * @returns {Quaternion}
   */
  //static slerp(r, v1, v2) {
  static slerp(v1, v2, r) {
    let dot = v1.dot(v2);
    //console.log("r: ", r);
    //console.log("v1: ", v1);
    //console.log("v2: ", v2);

    // If dot is very close to 1, fall back to LERP to avoid numerical instability
    if (Math.abs(dot) > 0.9995) {
      return Quaternion.lerp(r, v1, v2);
    }

    let theta = Math.acos(dot) * r;
    let sinTheta = Math.sin(theta);

    // Normalize v2 - v1 * dot
    let q = new Quaternion(
      v2.x - v1.x * dot,
      v2.y - v1.y * dot,
      v2.z - v1.z * dot,
      v2.w - v1.w * dot
    ).normalize();

        // Debug
    //console.log("q: ", q);
    //console.log("math theta: ", Math.cos(theta));

    // Interpolate
    return new Quaternion(
      v1.x * Math.cos(theta) + q.x * sinTheta,
      v1.y * Math.cos(theta) + q.y * sinTheta,
      v1.z * Math.cos(theta) + q.z * sinTheta,
      v1.w * Math.cos(theta) + q.w * sinTheta
    );
  }

  /**
   * Linear Interpolation (LERP) between two quaternions.
   * @param {number} r - Interpolation factor (0 to 1)
   * @param {Quaternion} v1
   * @param {Quaternion} v2
   * @returns {Quaternion}
   */
  static lerp(r, v1, v2) {
    return new Quaternion(
      v1.x * (1.0 - r) + v2.x * r,
      v1.y * (1.0 - r) + v2.y * r,
      v1.z * (1.0 - r) + v2.z * r,
      v1.w * (1.0 - r) + v2.w * r
    );
  }

  /**
   * Alternative Linear Interpolation (LERP).
   * @param {number} r
   * @param {Quaternion} v1
   * @param {Quaternion} v2
   * @returns {Quaternion}
   */
  static lerp2(r, v1, v2) {
    return Quaternion.lerp(r, v1, v2);
  }

  /**
   * Fixes the coordinate system of the quaternion.
   * @param {Quaternion} v
   * @returns {Quaternion}
   */
  static fixCoordSystemQuat(v) {
    return new Quaternion(-v.x, -v.z, v.y, v.w);
  }

  /**
   * Normalize this quaternion in place.
   * @returns {Quaternion} this
   */
  normalize() {
    let len = this.length();
    if (len > 0) {
      this.scaleAssign(1.0 / len);
    }
    return this;
  }

  /**
   * Returns a new normalized quaternion (without modifying this).
   * @returns {Quaternion}
   */
  normalized() {
    return Quaternion.fromVec4D(this).normalize();
  }

  /**
   * Returns a string representation of the quaternion.
   * @returns {string}
   */
  toString() {
    return `Quaternion(x: ${this.x}, y: ${this.y}, z: ${this.z}, w: ${this.w})`;
  }
}

//module.exports = { Quaternion };
export default Quaternion;

