// e.g. const MapConstants = { ZEROPOINT: 17066.0 };

class Vec3D {
  /**
   * Create a Vec3D.
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   */
  constructor(x = 0.0, y = 0.0, z = 0.0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  // -- "Copy constructor"
  static fromVec3D(other) {
    return new Vec3D(other.x, other.y, other.z);
  }

  // Equivalent to "Assign" in C#
  assign(other) {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  // --------------------------
  // Addition, Subtraction, Dot
  // --------------------------
  /**
   * Returns a new Vec3D that is this + other.
   */
  add(other) {
    return new Vec3D(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  /**
   * Returns a new Vec3D that is this - other.
   */
  sub(other) {
    return new Vec3D(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  /**
   * Dot product of this and other.
   * (returns a number, not a Vec3D)
   */
  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  /**
   * Returns a new Vec3D scaled by a scalar d.
   */
  scale(d) {
    return new Vec3D(this.x * d, this.y * d, this.z * d);
  }
  multiply(d) {
    return new Vec3D(this.x * d, this.y * d, this.z * d);
  }

  // --------------------------
  // Cross Product
  // --------------------------
  /**
   * Returns the cross product (this x other).
   */
  cross(other) {
    return new Vec3D(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }

  /**
   * Static cross product method, akin to C# static Cross(Vec3D a, Vec3D b).
   */
  static cross(a, b) {
    return new Vec3D(
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x
    );
  }

  // --------------------------
  // Length, Normalize
  // --------------------------
  lengthSquared() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length() {
    return Math.sqrt(this.lengthSquared());
  }

  normalize() {
    const len = this.length();
    if (len !== 0) {
      const invLength = 1.0 / len;
      this.x *= invLength;
      this.y *= invLength;
      this.z *= invLength;
    }
    return this;
  }

  normalized() {
    return Vec3D.fromVec3D(this).normalize();
  }

  // ------------
  // Negation
  // ------------
  negate() {
    return new Vec3D(-this.x, -this.y, -this.z);
  }

  // ------------------
  // FixCoordSystem etc
  // ------------------
  /**
   * In C#, returns new Vec3D { x = x, y = z, z = -y }
   */
  fixCoordSystem() {
    // `this.y` is used twice (once as y, once neg y?), so store them
    const oldX = this.x;
    const oldY = this.y;
    const oldZ = this.z;
    return new Vec3D(oldX, oldZ, -oldY);
  }

  fixCoordSystem2() {
    return new Vec3D(this.x, this.z, this.y);
  }

  // ------------
  // toArray, etc
  // ------------
  toArray() {
    return [this.x, this.y, this.z];
  }

  toFloatArray() {
    return new Float32Array([this.x, this.y, this.z]);
  }

  toDoubleArray() {
    return [this.x, this.y, this.z].map(v => Number(v)); // or just same array in JS
  }

  toString() {
    return `Vec3D(x: ${this.x}, y: ${this.y}, z: ${this.z})`;
  }

  // -------------
  // Min / Max
  // -------------
  static min(a, b) {
    return new Vec3D(
      Math.min(a.x, b.x),
      Math.min(a.y, b.y),
      Math.min(a.z, b.z)
    );
  }

  static max(a, b) {
    return new Vec3D(
      Math.max(a.x, b.x),
      Math.max(a.y, b.y),
      Math.max(a.z, b.z)
    );
  }

  // -------------
  // Rotation
  // -------------
  /**
   * Rotate around the X-Z plane, pivot at (x0, z0).
   * This modifies 'pos' in place (similar to C# ref).
   * 
   * @param {number} x0 
   * @param {number} z0 
   * @param {Vec3D} pos 
   * @param {number} angle 
   */
  static rotate(x0, z0, pos, angle) {
    const xa = pos.x - x0;
    const za = pos.z - z0;

    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);

    pos.x = xa * cosAngle - za * sinAngle + x0;
    pos.z = xa * sinAngle + za * cosAngle + z0;
    // pos.y is unchanged
  }

  // -------------
  // Coordinate transform (Wow coords, etc.)
  // -------------
  // NOTE: For these to work, define or import MapConstants.ZEROPOINT
  static toWowCoords(a, ZEROPOINT = 17066.0) {
    // return new Vec3D(-(a.z - ZEROPOINT), -(a.x - ZEROPOINT), a.y);
    return new Vec3D(
      -(a.z - ZEROPOINT),
      -(a.x - ZEROPOINT),
      a.y
    );
  }

  static toNormCoords(a, ZEROPOINT = 17066.0) {
    return new Vec3D(
      -(a.z + ZEROPOINT),
      a.y,
      -(a.x + ZEROPOINT)
    );
  }

  static fromWowCoords(a, ZEROPOINT = 17066.0) {
    return new Vec3D(
      ZEROPOINT - a.y,
      a.z,
      ZEROPOINT - a.x
    );
  }

  // -------------
  // "Matrix4 * Vec3D"  (Placeholder)
  // -------------
  /**
   * If you want something like "mat * Vec3D", create a function that applies
   * a 4x4 transform (for position) to the vector. For instance:
   */
  static transformPosition(mat4, v) {
    // Suppose mat4 is a 4x4 array [ [m11, m12, ...], [m21, ...], ... ]
    // or a Float32Array(16), etc. 
    // You can do your own matrix multiply, e.g.:
    const x = v.x, y = v.y, z = v.z;
    // Example if mat4 is an array in column-major order:
    const rx = mat4[0] * x + mat4[4] * y + mat4[8]  * z + mat4[12];
    const ry = mat4[1] * x + mat4[5] * y + mat4[9]  * z + mat4[13];
    const rz = mat4[2] * x + mat4[6] * y + mat4[10] * z + mat4[14];
    // w = mat4[3] * x + mat4[7] * y + mat4[11] * z + mat4[15];
    return new Vec3D(rx, ry, rz);
  }
}

//module.exports = { Vec3D };
export default Vec3D;

