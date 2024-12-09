import { Vector3 as V3 } from "@babylonjs/core";
import { Edge, HalfEdge, Loop, loopHalfEdges, Vertex } from "./Shape";
import { interpolateV3, tripleProduct, v3 } from "./geom-utils";


/**
 * Compute bend angles for the edge segments for proper folding of the
 * star to a polyhedron.
 * 
 * ``
 */
export default function computeBends(
  primaryVertices: Vertex[],
  vertexPositionsIn: Map<Vertex, V3>,
  edges: Edge[],
  centerFace: Loop,
  boundary: Loop,
  maxIterations: number,
  costLimit: number,
) {
  // Copy vertexPositions so that we can modify them without side effects to the
  // caller:
  const vertexPositions = new Map(vertexPositionsIn);

  // Utility functions using the vertex positions:

  const pos = (v: Vertex) => vertexPositions.get(v);

  const vec = (he: HalfEdge) => pos(he.to).subtract(pos(he.twin.to));

  const faceNormal = (face: Loop) => loopHalfEdges(face).reduce(
    (acc, he) => acc.addInPlace(pos(he.twin.to).cross(pos(he.to))),
    v3(),
  ).normalize();

  // Collect constraints:

  /**
   * A member `{from, distance}` of the list `forces.get(to).sources` means
   * that vertex `from` exerts a force on vertex `to`, trying to get it at
   * distance `distance`.  These forces contribute to a total force exerted
   * on vertex `to` given as `forces.get(to).totalForce`.
   * 
   * Each iteration step of our solver will first update `totalForce` and then
   * use this value to update the position of `to` in `vertexPositions`.
   * This way `pos(from)` and `pos(to)` will have new values in the next
   * iteration step.
   */
  const forces =
    new Map<Vertex, {sources: {from: Vertex, distance: number}[], totalForce: V3}>(
      primaryVertices.map(v => [v, {sources: [], totalForce: v3()}])
    );
  // Tip vertices want their neighboring tip vertices at distance 0:
  for (let i = 1; i < primaryVertices.length; i += 2) {
    const v0 = primaryVertices.at(i-2);
    const v1 = primaryVertices[i];
    forces.get(v1).sources.push({from: v0, distance: 0});
    forces.get(v0).sources.push({from: v1, distance: 0});
  }
  // The two ends of an edge want to have the edge length as their distance:
  for (const {from, to, length} of edges) {
    forces.get(to).sources.push({from: from, distance: length});
    forces.get(from).sources.push({from: to, distance: length});
  }

  // (Try to) solve the constraints iteratively by placing the primary vertices:
  const startTime = performance.now();
  const tmp = v3();
  let cost: number, i: number;
  for (i = 0; i < maxIterations; i++) {
    cost = 0;
    for (const [to, {sources, totalForce}] of forces) {
      const toPos = pos(to);
      totalForce.setAll(0);
      for (const {from, distance} of sources) {
        const fromPos = pos(from);
        if (distance === 0) {
          // totalForce += from - to
          totalForce.addInPlace(fromPos).subtractInPlace(toPos);
        } else {
          // totalForce += (distance - |to - from|) * normalize(to - from),
          // but written in a style avoiding memory allocations
          // in the inner loop where we are:
          toPos.subtractToRef(fromPos, tmp);
          const currentLength = tmp.length();
          tmp.normalize().scaleAndAddToRef(distance - currentLength, totalForce);
        }
        cost += totalForce.lengthSquared();
      }
    }
    if (cost < costLimit) break;

    for (const [to, {sources, totalForce}] of forces) {
      if (sources.length === 0) {
        console.warn(`no forces exerted on vertex "${to.name}"`);
        continue;
      }
      totalForce.scaleAndAddToRef(1 / sources.length, pos(to));
    }
  }
  const endTime = performance.now();
  console.log(`after ${i} steps (${endTime - startTime}ms): cost = ${cost}`);

  // Get the positions of secondary vertices (edge-breaks) by interpolating
  // along the edges.  (Edges should be straight and the two ends of a break
  // should coincide after constraint-solving.)
  for (const edge of edges) {
    for (const break_ of edge.breaks) {
      const cutPos = interpolateV3(pos(edge.from), pos(edge.to), break_.lambda);
      vertexPositions.set(break_.from, cutPos).set(break_.to, cutPos);
    }
  }

  // Now that we have vertex positions that (hopefully) fulfill the given
  // constraints, we "measure" the bending angles and write them to the
  // edge segments.  Notice that `measureBends(...)` recursively traverses
  // the faces in the same way as `bendEdges(...)` in `renderToCanvas(...)`,
  // but passing along face normals instead of `UVFrame`s.

  function measureBends(he: HalfEdge, normal: V3) {
    const {twin} = he;
    if (twin.loop === boundary) return;
    const twinNormal = faceNormal(twin.loop);
    he.computedBend = he.twin.computedBend = Math.atan2(
      tripleProduct(normal, twinNormal, vec(he).normalize()),
      normal.dot(twinNormal),
    );
    for (let heTmp = twin.next; heTmp !== twin; heTmp = heTmp.next) {
      measureBends(heTmp, twinNormal);
    }
  }

  const centerNormal = faceNormal(centerFace);
  loopHalfEdges(centerFace).forEach(he => measureBends(he, centerNormal));

  // For edges with multiple segments, check if they got (approximately) the
  // same autoBend.
  for (const {segments} of edges) {
    for (let i = 0; i < segments.length; i++) {
      const seg_i = segments[i];
      for (let j = i+1; j < segments.length; j++) {
        const seg_j = segments[j];
        const diff = Math.abs(seg_i.computedBend - seg_j.computedBend);
        if (diff > 1e-8) console.error(
          `computed bend angles for edge segments differ by`,
          diff.toExponential(3),
          `\n  ${seg_i.twin.to.name} - ${seg_i.to.name}: ${seg_i.computedBend}` +
          `\n  ${seg_j.twin.to.name} - ${seg_j.to.name}: ${seg_j.computedBend}`,
        );
      }
    }
  }
}
