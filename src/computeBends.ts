import { Vector3 as V3 } from "@babylonjs/core";
import { Edge, HalfEdge, Loop, loopHalfEdges, Vertex } from "./Shape";
import { interpolateV3, tripleProduct, v3, v3Average } from "./geom-utils";


/**
 * One direction of a distance constraint.
 * 
 * We want to fulfill the constraint that the distance between `from` and `to`
 * has the given value.
 * An `Impact` represents one direction of this constraint, namely that
 * `from` "pushes" or "pulls" `to` so that it is `distance` away.
 * (There may be another `Impact` for the opposite direction.)
 */
type Impact = {
  from: Vertex,
  to: Vertex,
  distance: number,
}

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

  // A few utility functions using the vertex positions:

  const pos = (v: Vertex) => vertexPositions.get(v);

  const vec = (from: Vertex, to: Vertex) => pos(to).subtract(pos(from));

  const actualLength = (impact: Impact) => vec(impact.to, impact.from).length();

  const faceNormal = (face: Loop) => loopHalfEdges(face).reduce(
    (acc, he) => acc.addInPlace(pos(he.twin.to).cross(pos(he.to))),
    v3(),
  ).normalize();

  /** Where the `from` vertex "wants" to have the `to` vertex */
  const targetPosition = ({from, to, distance}: Impact) =>
    distance === 0 ? pos(from) :
    pos(from).add(vec(from, to).normalize().scale(distance));

  // Collect constraints:

  let impacts = new Array<Impact>();
  // Tip vertices want their neighboring tip vertices at distance 0:
  for (let i = 1; i < primaryVertices.length; i += 2) {
    const v0 = primaryVertices[i];
    const v1 = primaryVertices.at(i-2);
    impacts.push({from: v0, to: v1, distance: 0}, {from: v1, to: v0, distance: 0})
  }
  // The two ends of an edge want to have the edge length as their distance:
  for (const {from, to, length} of edges) {
    impacts.push({from, to, distance: length}, {from: to, to: from, distance: length});
  }

  // (Try to) solve the constraints iteratively by placing the primary vertices:
  let cost: number, i: number;
  for (i = 0; i < maxIterations; i++) {
    cost = impacts
      .map(impact => Math.pow(actualLength(impact) - impact.distance, 2))
      .reduce((acc, impactCost) => acc + impactCost, 0);
    if (cost < costLimit) break;

    const targetPositions = new Map(primaryVertices.map(v => [v, [] as V3[]]));
    for (const impact of impacts) {
      targetPositions.get(impact.to).push(targetPosition(impact));
    }
    for (const [v, targets] of targetPositions) {
      vertexPositions.set(v, v3Average(targets));
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
      tripleProduct(twinNormal, normal, vec(he.to, he.twin.to).normalize()),
      twinNormal.dot(normal),
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
