import * as B from '@babylonjs/core';
import { Vector2 as V2, Vector3 as V3 } from '@babylonjs/core';
import { assert } from './utils';

const TAU = 2 * Math.PI;

const triangleArea = (p: V2, q: V2, r: V2) => {
  const pq = q.subtract(p);
  const pr = r.subtract(p);
  return ((pq.x * pr.y) - (pq.y * pr.x)) / 2;
};

/**
 * +1 or -1 (or even 0) depending on the orientation of triangle pqr in the
 * UV space.
 * 
 * We do not care which orientation is +1 or -1.  We just need consistency.
 */
const orientation = (p: V2, q: V2, r: V2) => Math.sign(triangleArea(p, q, r));

/** Is s inside triangle (p,q,r)? */
const contains = (p: V2, q: V2, r: V2, s: V2): boolean => {
  const pqr = orientation(p, q, r);
  const sqr = orientation(s, q, r);
  const psr = orientation(p, s, r);
  const pqs = orientation(p, q, s);
  return (
    // Consider "on the edge" (=== 0) to be inside:
    (sqr === pqr || sqr === 0) &&
    (psr === pqr || psr === 0) &&
    (pqs === pqr || pqs === 0)
  );
}


type VTX = {
  v: V2,
  i: number, // a temporary index;
};

/**
 * Triangulate a simple but possibly concave polygon (in 2D).
 * 
 * The implementation is intended to be readable and is not optimized.
 */
export default function triangulate(polygon: V2[]) {
  const vertices: VTX[] = polygon.map(v => ({v, i: -1 /* not yet used */}));

  /** 1. Triangles will be collected here. (The inner arrays will have 3 elements.) */
  const triangles: VTX[][] = [];

  /** 2. Recursively subdivide the polygon. */
  function recur(subPoly: VTX[]) {
    switch (subPoly.length) {
      case 0:
      case 1:
      case 2:
        return; // or fail?
      case 3: {
        // We have reached a triangle. Emit and stop the recursion.
        triangles.push(subPoly);
        return;
      }
      default: {
        // We still have 4 or more points

        // Set `.i` to be an index into `subPoly`.
        subPoly.forEach((s, i) => s.i = i);
        // Find the vertex index in `subPoly` with the highest u value.
        const iMax =
          subPoly.reduce((acc, elem) => acc.v.x > elem.v.x ? acc : elem).i;
        // Rotate the polygon and decomposeit into
        // - vertex `current` with the highest u value,
        // - its two neighbors `prev` and `next`,
        // - and the `rest`.
        const [prev, current, next, ...rest] =
          [...subPoly.slice(iMax - 1), ...subPoly.slice(0, iMax - 1)];
        // [prev, current, next] might be an "ear".

        // Find any `rest` points inside our ear candidate.
        const inCandidate: VTX[] =
          rest.filter(s => contains(prev.v, current.v, next.v, s.v));
        if (inCandidate.length === 0) {
          // [prev, current, next] is actually an ear.
          // Cut it off and continue with the remaining polygon.
          triangles.push([prev, current, next]);
          recur([prev, next, ...rest]);
        } else {
          // [prev, current, next] is not an ear.
          // Set `.i` to be an index into `rest`.
          rest.forEach((s, i) => s.i = i);
          // Find the `inCandidate` element (actually its index in `rest`)
          // with the highest u value.
          let iMax2 =
            inCandidate.reduce((acc, elem) => acc.v.x > elem.v.x ? acc : elem).i;
          // Cut the polygon from `current` to `vMax2`.  (By construction
          // the cut is along a diagonal which cannot intersect any other edge.)
          // Handle the two sub-polygons recursively.
          recur([current, next, ...rest.slice(0, iMax2 + 1)]);
          recur([prev, current, ...rest.slice(iMax2)]);
        }
      }
    }
  }

  // 3. Start the recursion
  recur(vertices);

  // Consistency check:
  assert(Math.abs(triangles.reduce((rest, ta) => rest - area(ta), area(vertices))) < 1e-8);

  // 4. Return the collected triangles
  return triangles.map(triangle => triangle.map(vtx => vtx.v));
}

function area(poly: VTX[]) {
  const [first, second, ...rest] = poly.map(vtx => vtx.v);
  let sum = 0;
  let prev = second;
  for (const current of rest) {
    sum += triangleArea(first, prev, current);
    prev = current;
  }
  return sum / 2;
}
