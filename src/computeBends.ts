import { Vector3 as V3 } from "@babylonjs/core";
import { Edge, HalfEdge, Loop, loopHalfEdges, Vertex } from "./Shape";
import { interpolateV3, tripleProduct, v3 } from "./geom-utils";
import { assert } from "./utils";


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
   * `targets.get(to)` including `{from, distance, target}` means that
   * `from` would like to place `to` in position `target`.
   */
  const forces =
    new Map<Vertex, {from: Vertex, distance: number, target: V3}[]>(
      primaryVertices.map(v => [v, []])
    );
  // Tip vertices want their neighboring tip vertices at distance 0:
  for (let i = 1; i < primaryVertices.length; i += 2) {
    const v0 = primaryVertices.at(i-2);
    const v1 = primaryVertices[i];
    forces.get(v1).push({from: v0, distance: 0, target: v3()});
    forces.get(v0).push({from: v1, distance: 0, target: v3()});
  }
  // The two ends of an edge want to have the edge length as their distance:
  for (const {from, to, length} of edges) {
    forces.get(to).push({from: from, distance: length, target: v3()});
    forces.get(from).push({from: to, distance: length, target: v3()});
  }
  forces.values().forEach(impacts => assert(impacts.length > 0));


  // (Try to) solve the constraints iteratively by placing the primary vertices:
  const tmp = v3();
  let cost: number, i: number;
  for (i = 0; i < maxIterations; i++) {
    cost = 0;
    for (const [to, toTargets] of forces) {
      const toPos = pos(to);
      for (const {from, distance, target} of toTargets) {
        const fromPos = pos(from);
        if (distance === 0) {
          target.copyFrom(fromPos);
        } else {
          // target = from + distance * normalize(to - from),
          // but written in a style avoiding memory allocations
          // in the inner loop where we are:
          fromPos.addToRef(
            toPos.subtractToRef(fromPos, tmp)
              .normalize().scaleInPlace(distance),
            target
          )
        }
        cost += target.subtractToRef(toPos, tmp).lengthSquared();
      }
    }
    if (cost < costLimit) break;

    for (const [to, toForces] of forces) {
      const toPos = pos(to);
      toPos.setAll(0);
      for (const {target} of toForces) {
        toPos.addInPlace(target);
      }
      toPos.scaleInPlace(1 / toForces.length);
    }
  }
  console.log(`after ${i} steps: cost = ${cost}`);

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
