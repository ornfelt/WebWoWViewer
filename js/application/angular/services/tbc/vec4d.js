class Vec4D {
  /**
   * Create a Vec4D instance.
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} w 
   */
  constructor(x = 0.0, y = 0.0, z = 0.0, w = 0.0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  /**
   * Copy constructor equivalent.
   * @param {Vec4D} v 
   * @returns {Vec4D}
   */
  static fromVec4D(v) {
    return new Vec4D(v.x, v.y, v.z, v.w);
  }

  /**
   * Create a Vec4D from a Vec3D and w.
   * @param {Vec3D} v 
   * @param {number} w0 
   * @returns {Vec4D}
   */
  static fromVec3D(v, w0) {
    return new Vec4D(v.x, v.y, v.z, w0);
  }

  /**
   * Assign values from another Vec4D.
   * @param {Vec4D} v 
   * @returns {Vec4D} this
   */
  assign(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    this.w = v.w;
    return this;
  }

  // -------------------------------
  // Arithmetic Operators (Add, Sub, Scale)
  // -------------------------------

  /**
   * Returns a new Vec4D that is this + other.
   * @param {Vec4D} other 
   * @returns {Vec4D}
   */
  add(other) {
    return new Vec4D(this.x + other.x, this.y + other.y, this.z + other.z, this.w + other.w);
  }

  /**
   * Returns a new Vec4D that is this - other.
   * @param {Vec4D} other 
   * @returns {Vec4D}
   */
  sub(other) {
    return new Vec4D(this.x - other.x, this.y - other.y, this.z - other.z, this.w - other.w);
  }

  /**
   * Returns a new Vec4D that is this scaled by d.
   * @param {number} d 
   * @returns {Vec4D}
   */
  scale(d) {
    return new Vec4D(this.x * d, this.y * d, this.z * d, this.w * d);
  }

  /**
   * Dot product (returns a number, not a Vec4D).
   * @param {Vec4D} other 
   * @returns {number}
   */
  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z + this.w * other.w;
  }

  // -------------------------------
  // Assignment Operators
  // -------------------------------

  /**
   * Adds another Vec4D to this in place.
   * @param {Vec4D} v 
   * @returns {Vec4D} this
   */
  addAssign(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    this.w += v.w;
    return this;
  }

  /**
   * Subtracts another Vec4D from this in place.
   * @param {Vec4D} v 
   * @returns {Vec4D} this
   */
  subAssign(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    this.w -= v.w;
    return this;
  }

  /**
   * Scales this vector by a scalar in place.
   * @param {number} d 
   * @returns {Vec4D} this
   */
  scaleAssign(d) {
    this.x *= d;
    this.y *= d;
    this.z *= d;
    this.w *= d;
    return this;
  }

  // -------------------------------
  // Length, Normalize
  // -------------------------------

  /**
   * Returns the squared length of the vector.
   * @returns {number}
   */
  lengthSquared() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  /**
   * Returns the length of the vector.
   * @returns {number}
   */
  length() {
    return Math.sqrt(this.lengthSquared());
  }

  /**
   * Normalizes this vector in place.
   * @returns {Vec4D} this
   */
  normalize() {
    const len = this.length();
    if (len > 0) {
      this.scaleAssign(1.0 / len);
    }
    return this;
  }

  /**
   * Returns a new normalized vector (without modifying this).
   * @returns {Vec4D}
   */
  normalized() {
    return Vec4D.fromVec4D(this).normalize();
  }

  // -------------------------------
  // Conversion Functions
  // -------------------------------

  /**
   * Returns a Vec3D version (XYZ components only).
   * @returns {Vec3D}
   */
  toVec3D() {
    const { Vec3D } = require('./vec3d'); // Require Vec3D if in a separate file
    return new Vec3D(this.x, this.y, this.z);
  }

  /**
   * Converts the vector to an array.
   * @returns {number[]}
   */
  toArray() {
    return [this.x, this.y, this.z, this.w];
  }

  /**
   * Converts the vector to a Float32Array (useful for WebGL).
   * @returns {Float32Array}
   */
  toFloatArray() {
    return new Float32Array([this.x, this.y, this.z, this.w]);
  }

  /**
   * Returns a string representation of the vector.
   * @returns {string}
   */
  toString() {
    return `Vec4D(x: ${this.x}, y: ${this.y}, z: ${this.z}, w: ${this.w})`;
  }
}

//module.exports = { Vec4D };
export default Vec4D;

