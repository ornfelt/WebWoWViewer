import Vec3D from "./vec3d.js";
import Vec4D from "./vec4d.js";

export function interpolate(r, v1, v2) {
  if (v1 && typeof v1 === "object" && "x" in v1 && "y" in v1 && "z" in v1 && "w" in v1) {
    return new Vec4D(
      v1.x * (1 - r) + v2.x * r,
      v1.y * (1 - r) + v2.y * r,
      v1.z * (1 - r) + v2.z * r,
      v1.w * (1 - r) + v2.w * r
    );
  } else if (v1 && typeof v1 === "object" && "x" in v1 && "y" in v1 && "z" in v1) {
    return new Vec3D(
      v1.x * (1 - r) + v2.x * r,
      v1.y * (1 - r) + v2.y * r,
      v1.z * (1 - r) + v2.z * r
    );
  }

  return v1 * (1 - r) + v2 * r;
}

// Numeric Hermite interpolation.
export function interpolateHermite(r, v1, v2, inVal, outVal) {
  const h1 = 2 * r * r * r - 3 * r * r + 1;
  const h2 = -2 * r * r * r + 3 * r * r;
  const h3 = r * r * r - 2 * r * r + r;
  const h4 = r * r * r - r * r;
  return v1 * h1 + v2 * h2 + inVal * h3 + outVal * h4;
}

// Hermite interpolation for quaternions.
// Assumes that Quaternion provides multiplyScalar() and add() methods.
export function interpolateHermiteQuaternion(r, v1, v2, inVal, outVal) {
  const h1 = 2 * r * r * r - 3 * r * r + 1;
  const h2 = -2 * r * r * r + 3 * r * r;
  const h3 = r * r * r - 2 * r * r + r;
  const h4 = r * r * r - r * r;
  
  const term1 = v1.multiplyScalar(h1);
  const term2 = v2.multiplyScalar(h2);
  const term3 = inVal.multiplyScalar(h3);
  const term4 = outVal.multiplyScalar(h4);
  
  return term1.add(term2).add(term3).add(term4);
}

