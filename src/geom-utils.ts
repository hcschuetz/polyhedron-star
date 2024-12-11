import { Quaternion, Vector2 as V2, Vector3 as V3 } from '@babylonjs/core';
import { assert } from './utils';

export const TAU = 2 * Math.PI;

export const v2 = (x?: number , y?: number) => new V2(x, y);
export const v3 = (x?: number, y?: number, z?: number) => new V3(x, y, z);


const aux2_0 = v2();
const aux2_1 = v2();
const aux2_2 = v2();

export const rotateAroundInPlace = (v: V2, pivot: V2, angle: number) =>
  v.subtractToRef(pivot, aux2_0).rotateToRef(angle, aux2_1).addToRef(pivot, v);

export const interpolateV2 = (p: V2, q: V2, lambda: number) =>
  p.add(q.subtractToRef(p, aux2_0).scaleInPlace(lambda));

/**
 * Find the intersection between lines `p0 p1` and `q0 q1`.
 * 
 * If the lines are not parallel, the return value `[np, nq, d]`
 * has the property that the expressions
 * `p0 + (np / d) (p1 - p0)` and `q0 + (nq / d) (q1 - q0)`
 * are equal and denote the point of intersection.
 * 
 * If the two lines are parallel (or one of the given line segments has length 0),
 * `d` is 0.
 * The divisions by `d` are left to the caller so that it can check `d`
 * and react appropriately to the special cases.
 */
export function intersectLineSegments(p0: V2, p1: V2, q0: V2, q1: V2) {
  const dp = p1.subtractToRef(p0, aux2_0);
  const dq = q1.subtractToRef(q0, aux2_1);
  const d0 = q0.subtractToRef(p0, aux2_2);
  const np = d0.x * dq.y - dq.x * d0.y;
  const nq = d0.x * dp.y - dp.x * d0.y;
  const d  = dp.x * dq.y - dq.x * dp.y;
  return [np, nq, d];
}

function test_intersectLineSegments() {
  const p0 = v2(3,5), p1 = v2(5,-2), q0 = v2(-.3, 7), q1 = v2(3.3, -8);
  const [np, nq, d] = intersectLineSegments(p0, p1, q0, q1);
  const inters_p = interpolateV2(p0, p1, np / d);
  const inters_q = interpolateV2(q0, q1, nq / d);
  assert(inters_q.subtract(inters_p).length() < 1e-8);
  console.log("test_intersectLineSegments passed");
}

// test_intersectLineSegments();

export const v3Sum = (ps: V3[]): V3 =>
  ps.reduce((acc, p) => acc.addInPlace(p), v3());

export const v3Average = (ps: V3[]): V3 =>
  v3Sum(ps).scaleInPlace(1 / ps.length);

export const tripleProduct = (a: V3, b: V3, c: V3) => a.dot(b.cross(c));

/** Angle between a and b as seen by c, which should be orthogonal to a and b */
export const directedAngle = (a: V3, b: V3, c: V3): number =>
  Math.atan2(tripleProduct(a, b, c.normalizeToNew()), a.dot(b));

export const aux3_0 = v3();

export const interpolateV3 = (p: V3, q: V3, lambda: number) =>
  p.add(q.subtractToRef(p, aux3_0).scaleInPlace(lambda));

export function arcPath(center: V3, from: V3, to: V3, nSteps: number) {
  const vecFrom = from.subtract(center);
  const vecTo = to.subtract(center);
  // assert(Math.abs(vecTo.length() - vecFrom.length()) < 1e-8);
  const omega = Math.acos(vecFrom.normalizeToNew().dot(vecTo.normalizeToNew()));
  const oneBySinOmega = 1 / Math.sin(omega);
  return Array.from({length: nSteps + 1}, (_, i) => {
    const lambda = i / nSteps;
    return center.add(
      vecFrom.scale(Math.sin((1-lambda) * omega) * oneBySinOmega).add(
      vecTo  .scale(Math.sin(   lambda  * omega) * oneBySinOmega))
    );
  });
}

/** Embedding a plane with (orthonormal) 2D coordinates in 3D */
export class UVFrame {
  constructor(
    readonly origin: V3,
    readonly eu: V3,
    readonly ev: V3,
  ) {
    // Apparently we cannot use the usual limit of 1e-8 here:
    assert(Math.abs(eu.lengthSquared() - 1) < 1e-5);
    assert(Math.abs(ev.lengthSquared() - 1) < 1e-5);
    assert(Math.abs(eu.dot(ev)) < 1e-5);

    // // Normalize to reduce error propagation:
    // eu.normalize();
    // ev.normalize();
  }

  toString() { return `UVFrame(${this.origin}, ${this.eu}, ${this.ev})`; }

  // TODO rename this to "injectOffsetAndAddToRef" and make it public?
  #inject(uv: V2, ref: V3): V3 {
    this.eu.scaleAndAddToRef(uv.x, ref);
    this.ev.scaleAndAddToRef(uv.y, ref);
    return ref;
  }

  injectOffset(uv: V2): V3 { return this.#inject(uv, v3()); }
  injectPoint(uv: V2): V3 { return this.#inject(uv, this.origin.clone()); }

  projectOffset(xyz: V3): V2 {
    return v2(xyz.dot(this.eu), xyz.dot(this.ev));
  }

  projectPoint(xyz: V3): V2 {
    return this.projectOffset(xyz.subtract(this.origin));
  }

  /**
   * Create a rotated `UVFrame`.
   *
   * Given two points `p` and `q` (in 3D coordinates),
   * construct a new `UVFrame` by rotating this frame around the line
   * through `p` and `q` by the given angle.
   *
   * If p and q are actually on the UV plane, then they (and all other points
   * on the line through p and q) have the same coordinates in this frame and
   * the new frame.
   */
  rotateAroundLine(p: V3, q: V3, angle: number): UVFrame {
    const quaternion = Quaternion.RotationAxis(q.subtract(p).normalize(), angle);
    return new UVFrame(
      this.origin.rotateByQuaternionAroundPointToRef(quaternion, p, v3()),
      // .normalize() to avoid error accumulation:
      this.eu.rotateByQuaternionToRef(quaternion, v3()).normalize(),
      this.ev.rotateByQuaternionToRef(quaternion, v3()).normalize(),
    );
  }
}
