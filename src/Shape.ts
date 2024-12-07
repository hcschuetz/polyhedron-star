import { Vector2 as V2 } from "@babylonjs/core";

import { fail } from "./utils";
import { TAU } from "./geom-utils";


export type Vertex = {
  name: string;
  /**
   * position along the star boundary
   * 
   * odd: tip; even: gap apex; non-integer: intersection with edge
   */
  pos1D: number;
  pos2D: V2;
  firstHalfEdgeOut?: HalfEdge;
};

export type Loop = {
  name: string;
  firstHalfEdge: HalfEdge;
  minStepsToTip?: number;
};

// Actually a "HalfSegment":
export type HalfEdge = {
  to: Vertex;
  loop?: Loop;
  twin?: HalfEdge;
  next?: HalfEdge;
  // prev: HalfEdge;

  /** Angle from positive x axis to this half edge, in radians */
  direction: number;

  /** Bending angle along this edge */
  bend?: number;
};

export function makeSegment(v0: Vertex, v1: Vertex): HalfEdge {
  const diff = v1.pos2D.subtract(v0.pos2D);
  const direction = Math.atan2(diff.y, diff.x);
  const he0: HalfEdge = {to: v1, direction};
  const he1: HalfEdge = {to: v0, direction: (direction + TAU/2) % TAU};
  he0.twin = he1; he1.twin = he0;
  return he0;
}

export function* loopHalfEdges(loop: Loop): Generator<HalfEdge, void, void> {
  let he = loop.firstHalfEdge, count: 0;
  do {
    yield he;
    if (count++ > 50) fail(`run-away iteration around loop`);
    he = he.next;
  } while (he !== loop.firstHalfEdge);
}

/**
 * An edge where the polyhedron is bent.
 * It may be subdivided into multiple segments in the star.
 */
export type Edge = {
  from: Vertex,
  to: Vertex,
  /**
   * Is this edge along a cut in the polyhedron,
   * that is, along the star boundary?
   */
  alongCut: boolean,
  length: number,
  /**
   * The "bend angle" is `TAU/2 - dihedral angle`.  So a value of 0 means
   * that there is actually no bend.
   *
   * The bend angle may be negative to indicate bending in the other direction.
   */
  bendAngle: number,

  // There should be one more segment than breaks.
  breaks: EdgeBreak[],
  segments: HalfEdge[],
};

export type EdgeBreak = {
  from: Vertex,
  to: Vertex,
  pivot: Vertex,
}
