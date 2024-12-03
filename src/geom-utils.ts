import { Vector2 as V2, Vector3 as V3 } from '@babylonjs/core';
import { assert } from './utils';

export const v2 = (x?: number , y?: number) => new V2(x, y);
export const v3 = (x?: number, y?: number, z?: number) => new V3(x, y, z);

export const v2ToV3 = ({x, y}: V2) => v3(x,y);


const aux0 = v2();
const aux1 = v2();
const aux2 = v2();

export const rotateAroundInPlace = (v: V2, pivot: V2, angle: number) =>
  v.subtractToRef(pivot, aux0).rotateToRef(angle, aux1).addToRef(pivot, v);

export const interpolateV2 = (p: V2, q: V2, lambda: number) =>
  p.add(q.subtractToRef(p, aux0).scaleInPlace(lambda));

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
  const dp = p1.subtractToRef(p0, aux0);
  const dq = q1.subtractToRef(q0, aux1);
  const d0 = q0.subtractToRef(p0, aux2);
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


export function arcPath(center: V2, from: V2, to: V2, nSteps: number) {
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
