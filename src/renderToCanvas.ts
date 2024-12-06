import * as B from '@babylonjs/core';
import { Vector2 as V2, Vector3 as V3 } from '@babylonjs/core';
import * as G from '@babylonjs/gui';
import JSON5 from 'json5';

import { assert, fail } from './utils';
import { angleToRad, Task, stepToV2 } from './taskspec';
import { arcPath, interpolateV2, intersectLineSegments, rotateAroundInPlace, UVFrame, v2, v3 } from './geom-utils';

const TAU = 2 * Math.PI;

type Vertex = {
  name: string;
  /**
   * position along the star boundary
   * 
   * odd: tip; even: gap apex; non-integer: intersection with edge
   */
  pos1D: number;
  pos2D: V2;
  pos3D?: V3;
  firstHalfEdgeOut?: HalfEdge;
};

type Loop = {
  name: string;
  firstHalfEdge: HalfEdge;
  minStepsToTip?: number;
};

// Actually a "HalfSegment":
type HalfEdge = {
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

function makeSegment(v0: Vertex, v1: Vertex): HalfEdge {
  const diff = v1.pos2D.subtract(v0.pos2D);
  const direction = Math.atan2(diff.y, diff.x);
  const he0: HalfEdge = {to: v1, direction};
  const he1: HalfEdge = {to: v0, direction: (direction + TAU/2) % TAU};
  he0.twin = he1; he1.twin = he0;
  return he0;
}

function* loopHalfEdges(loop: Loop): Generator<HalfEdge, void, void> {
  let he = loop.firstHalfEdge, count: 0;
  do {
    yield he;
    if (count++ > 50) fail(`run-away iteration around loop`);
    he = he.next;
  } while (he !== loop.firstHalfEdge);
}

function* vertexHalfEdges(v: Vertex): Generator<HalfEdge, void, void> {
  let he = v.firstHalfEdgeOut, count: 0;
  do {
    yield he;
    if (count++ > 50) fail(`run-away iteration around loop`);
    he = he.twin.next;
  } while (he !== v.firstHalfEdgeOut);
}

/**
 * An edge where the polyhedron is bent.
 * It may be subdivided into multiple segments in the star.
 */
type Edge = {
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
  segments: HalfEdge[],
};

export default function renderToCanvas(
  canvas: HTMLCanvasElement,
  taskString: string,
  bendFraction: number,
) {
  const task: Task = JSON5.parse(taskString);

  // TODO type-check task

  // ---------------------------------------------------------------------------

  const gapIndex = new Map(task.star.gaps.map((v, i) => [v.name, i]));

  const primaryVertices = new Array<Vertex>();

  let pos = V2.Zero();
  let totalAngleDeficit = 0;
  task.star.gaps.forEach(({name, angleDeficit, steps}, i, array) => {
    const stepTotal = V2.Zero();
    for (const step of steps) {
      stepTotal.addInPlace(stepToV2(step));
    }
    const gapAngle = angleToRad(angleDeficit);
    totalAngleDeficit += gapAngle;
    const baseAngle = (Math.PI - gapAngle) / 2;
    const inner = pos.add(stepTotal.rotateToRef(baseAngle, v2()).scaleInPlace(.5/Math.cos(baseAngle)));
    pos = pos.add(stepTotal);
    const tipName = `${name}^${array[(i+1)%array.length].name}`;
    primaryVertices.push({name         , pos1D: primaryVertices.length, pos2D: inner});
    primaryVertices.push({name: tipName, pos1D: primaryVertices.length, pos2D: pos  });
  });
  const remainingAngleDeficit = 2*TAU - totalAngleDeficit;
  console.log(
    `Total angle deficit: ${totalAngleDeficit} = ${
      (totalAngleDeficit*(360/TAU)).toFixed(5)
    }°\nremaining:           ${remainingAngleDeficit} = ${
      (remainingAngleDeficit*(360/TAU)).toFixed(5)}°`
  );

  const vertices: Vertex[] = primaryVertices.slice();
  const edges: Edge[] = [];
  for (const e of task.edges) {
    if (typeof e === "string") {
      const index = gapIndex.get(e);
      const inner = primaryVertices[2*index];
      const outer = primaryVertices[2*index+1];
      edges.push({
        from: inner,
        to: outer,
        alongCut: true,
        length: outer.pos2D.subtract(inner.pos2D).length(),
        bendAngle: 0, // We do not explicitly bend an edge along a cut.
        segments: [makeSegment(inner, outer)],
      });
    } else {
      const {from, to, through = [], angle} = e;
      const fromIndex = gapIndex.get(from);
      const fromVertex = primaryVertices[2*fromIndex];
      const fromPos = fromVertex.pos2D;
      const toVertex = primaryVertices[2*gapIndex.get(to)];
      const bendAngle = angleToRad(angle);

      let toPosRotated = toVertex.pos2D.clone();
      const rotations: {index: number, inner: V2, outer: V2}[] = [];
      for (const thr of through.toReversed()) {
        const index = gapIndex.get(thr);
        const pivot = primaryVertices[2*index].pos2D;
        const angleDefNeg = -angleToRad(task.star.gaps[index].angleDeficit);
        rotateAroundInPlace(toPosRotated, pivot, angleDefNeg);
        for (const {inner, outer} of rotations) {
          rotateAroundInPlace(inner, pivot, angleDefNeg);
          rotateAroundInPlace(outer, pivot, angleDefNeg);
        }
        rotations.unshift({
          index,
          inner: pivot.clone(),
          outer: primaryVertices.at(2*index-1).pos2D.clone(),
        });
      }
      const length = toPosRotated.subtract(fromPos).length();

      let prevVertex = fromVertex;
      const segments = rotations.map(({index, inner, outer}) => {
        const [np,, d] = intersectLineSegments(inner, outer, fromPos, toPosRotated);
        const lambda = np / d;
        if (lambda < 1e-8 || lambda > 1 - 1e-8) console.error(
          `edge ${from}-${to} does not pass through gap ${name}`
        );
        const pivot = primaryVertices[2*index];
        const v0: Vertex = {
          name: `${pivot.name}#${fromVertex.name}<${toVertex.name}`,
          pos1D: 2*index - lambda,
          pos2D: interpolateV2(
            pivot.pos2D,
            primaryVertices.at(2*index-1).pos2D,
            lambda,
          ),
        };
        const v1: Vertex = {
          name: `${pivot.name}#${fromVertex.name}>${toVertex.name}`,
          pos1D: 2*index + lambda,
          pos2D: interpolateV2(
            pivot.pos2D,
            primaryVertices[(2*index+1) % primaryVertices.length].pos2D,
            lambda
          ),
        };
        vertices.push(v0, v1);
        const seg = makeSegment(prevVertex, v0);

        prevVertex = v1;
        return seg;
      });
      segments.push(makeSegment(prevVertex, toVertex));
      edges.push({
        from: fromVertex,
        to: toVertex,
        alongCut: false,
        length,
        bendAngle,
        segments,
      });
    }
  }

  vertices.sort((v0, v1) => v0.pos1D - v1.pos1D);
  console.log(vertices.map(v => `${v.name.padEnd(8)} @ ${v.pos1D.toFixed(3)} / (${v.pos2D.x.toFixed(2)}, ${v.pos2D.y.toFixed(2)})`).join("\n"))
  const cuts = vertices.map((v, i) => makeSegment(vertices.at(i-1), v));

  const segmentIndex = Map.groupBy<Vertex, HalfEdge>(
    [
      ...edges.flatMap(edge =>
        edge.alongCut ? [] : edge.segments.flatMap(he0 => [he0, he0.twin])
      ),
      ...cuts.flatMap(cut => [cut, cut.twin]),
    ],
    entry => entry.twin.to,
  );
  const allSegments = segmentIndex.values().flatMap(hes => hes).toArray();

  const subfaces = new Array<Loop>();
  for (const he of allSegments) {
    if (he.loop) continue;
    let loopName = "loop#" + subfaces.length + ": " + he.twin.to.name;
    const loop: Loop = {
      name: "tempName",
      firstHalfEdge: he,
    };
    subfaces.push(loop);

    let heTmp = he, count = 0;
    loopSetupLoop: do {
      loopName += " -- " + heTmp.to.name;
      let nextAngle = Number.POSITIVE_INFINITY;
      let nextHE: HalfEdge;
      for (const heOut of segmentIndex.get(heTmp.to)) {
        const outAngle = (heTmp.direction - heOut.direction + 3*TAU/2) % TAU;
        if (1e-8 < outAngle && outAngle < nextAngle) {
          nextAngle = outAngle;
          nextHE = heOut;
        }
      }
      heTmp.next = nextHE;
      nextHE.loop = loop;
      heTmp = nextHE;
      if (++count > 50) {console.error("runaway iteration"); break loopSetupLoop;}
    } while (heTmp !== he);
    loop.name = loopName;
  }

  for (const seg of allSegments) {
    seg.to.firstHalfEdgeOut = seg.twin;
  }

  const boundary = cuts[0].twin.loop;

  // A heuristic approach to identify some "central" face:
  propagateShortestPath(boundary, 0);
  function propagateShortestPath(face: Loop, lengthToFace: number) {
    if (lengthToFace >= face.minStepsToTip) return;
    face.minStepsToTip = lengthToFace;
    for (const he of loopHalfEdges(face)) {
      const stepLength = he.to.pos2D.subtract(he.twin.to.pos2D).length();
      propagateShortestPath(he.twin.loop, lengthToFace + stepLength);
    }
  }

  let centerFace: Loop = undefined;
  for (const loop of subfaces) {
    if (centerFace === undefined || loop.minStepsToTip > centerFace.minStepsToTip) {
      centerFace = loop;
    }
  }

  for (const {bendAngle, segments} of edges) {
    for (const he of segments) {
      he.bend = bendAngle;
      he.twin.bend = bendAngle;
    }
  }

  const starCenter = primaryVertices
    .reduce((acc, vtx) => acc.addInPlace(vtx.pos2D), V2.Zero())
    .scaleInPlace(1 / primaryVertices.length);

  const starFrame = new UVFrame(
    v3(-starCenter.x, -starCenter.y, 0),
    v3(1, 0, 0),
    v3(0, 1, 0),
  );

  function bendEdges(depth: number, he: HalfEdge, frame: UVFrame) {
    const {twin, to} = he;
    const from3D = frame.injectPoint(twin.to.pos2D);
    const to3D   = frame.injectPoint(to.pos2D);
    to.pos3D = to3D;
    if (twin.loop === boundary) return;
    console.log("  ".repeat(depth) + "entering: " + twin.loop.name);
    const newFrame = frame.rotateAroundLine(from3D, to3D, he.bend * bendFraction);
    for (let heTmp = twin.next; heTmp !== twin; heTmp = heTmp.next) {
      bendEdges(depth + 1, heTmp, newFrame);
    }
    console.log("  ".repeat(depth) + "leaving :", twin.loop.name);
  }
  console.log("center face:", centerFace.name);
  loopHalfEdges(centerFace).forEach(he => bendEdges(1, he, starFrame));

  // ---------------------------------------------------------------------------

  const noBubble = (e: Event) => e.preventDefault();
  canvas.addEventListener("wheel", noBubble);

  const colors = {
    edge: B.Color3.Green(),
    cut: B.Color3.Red(),
    tip: B.Color3.Red(),
    inner: B.Color3.Blue(),
    face: B.Color3.Yellow(),
    grid: B.Color3.Black(),
    flower: B.Color3.Red(),
  };

  const engine = new B.Engine(canvas, true);
  const scene = new B.Scene(engine);

  const advancedTexture = G.AdvancedDynamicTexture.CreateFullscreenUI("myUI", true, scene);
  advancedTexture.rootContainer.scaleX = window.devicePixelRatio;
  advancedTexture.rootContainer.scaleY = window.devicePixelRatio;

  const edgeMaterial = standardMaterial("edgeMaterial", {
    diffuseColor: colors.edge,
  }, scene);

  const tipMaterial = standardMaterial("tipMaterial", {
    diffuseColor: colors.tip,
  }, scene);

  const innerMaterial = standardMaterial("innerMaterial", {
    diffuseColor: colors.inner,
  }, scene);

  const faceMaterial = standardMaterial("faceMaterial", {
    diffuseColor: colors.face,
    roughness: 100,
    transparencyMode: B.Material.MATERIAL_ALPHABLEND,
    alpha: 0.6,
    // wireframe: true,
    sideOrientation: B.VertexData.DOUBLESIDE,
    backFaceCulling: false,
  }, scene);

  const gridMaterial = standardMaterial("gridMaterial", {
    diffuseColor: colors.grid,
  }, scene);

  // if (showVertices)
  {
    const vertexPatterns = [innerMaterial, tipMaterial].map(mat =>
      Object.assign(
        B.MeshBuilder.CreateIcoSphere("tip", {
          radius: .05,
          subdivisions: 3,
          flat: false,
        }, scene), {
          material: mat,
          isVisible: false,
        }
      )
    );
    primaryVertices.forEach(({name, pos3D}, i) => Object.assign(
      vertexPatterns[i % 2].createInstance(name), {
        position: pos3D,
      }
    ));
  }
  {
    primaryVertices.forEach(({pos3D, name}, i) => {
      if (i % 2 !== 0) return;
      // if (showVertexNames)
      {
        const labelPos = new B.TransformNode("labelPos" + i, scene);
        labelPos.position = v3(0, .2, 0).addInPlace(pos3D);
        const label = new G.TextBlock("label" + i, name);
        label.color = "#fff";
        label.fontSize = 16;
        advancedTexture.addControl(label);
        label.linkWithMesh(labelPos);
      }
      // if (showFlower)
      B.CreateGreasedLine(`flower${i}`, {
        points: arcPath(
          pos3D,
          primaryVertices.at(i-1).pos3D,
          primaryVertices[i+1].pos3D,
          20,
        ),
      }, {
        width: .01,
        color: colors.flower,
      }, scene);
    });
  }
  // if (showCuts)
  if (false) {
    for (const cut of cuts) {
      B.CreateGreasedLine("cut", {
        points: [cut.twin.to.pos3D, cut.to.pos3D],
      }, {
        width: .01,
        color: colors.cut,
      }, scene);
    }
  }
  // if (showEdges)
  {
    for (const {segments} of edges) {
      for (const {twin: {to: from}, to} of segments) {
        Object.assign(
          B.MeshBuilder.CreateTube("seg", {
            path: [from.pos3D, to.pos3D],
            radius: .01,
          }, scene), {
            material: edgeMaterial,
          }
        );
      }
    }
    task.edges.forEach((e, i) => {
      if (typeof e === "string") return;
      if (!e.through) return;
      const edge = edges[i];
      e.through.forEach((name, j) => {
        const from = edge.segments[j].to.pos3D;
        const to = edge.segments[j+1].twin.to.pos3D;
        const index = gapIndex.get(name);
        const center = primaryVertices[2*index].pos3D;
        B.CreateGreasedLine(`arc${i}_${j}`, {
          points: arcPath(center, from, to, 10),
        }, {
          width: .01,
          color: colors.edge,
        }, scene);
      });
    });
  }
  // if (showFaces)
  {
    const positions = new Array<[number, number, number]>();
    for (const face of subfaces) {
      if (face === boundary) continue;
      const [first, second, ...rest] = loopHalfEdges(face);
      const pivot = first.to;
      assert (second.twin.to === pivot);
      for (const current of rest) {
        positions.push(
          pivot.pos3D.asArray(),
          current.twin.to.pos3D.asArray(),
          current.to.pos3D.asArray(),
        )
      }
    }
    const mesh = Object.assign(new B.Mesh("faces", scene), {
      material: faceMaterial,
    });
    const vertexData = Object.assign(new B.VertexData(), {
      positions: positions.flat(),
      indices: positions.map((_, i) => i),
    });
    vertexData.applyToMesh(mesh);
  }

  const camera = Object.assign(
    new B.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 10, v3(0, 0, 0), scene), {
      lowerRadiusLimit: 3,
      upperRadiusLimit: 30,
    }
  );
  camera.attachControl(canvas, true);

  [
    [v3( 10,  10,   0)],
    [v3(-10, -10,  10)],
    [v3(-10,   0, -10)],
    [v3(  0, -10, -10)],
    [v3( 10,   0,  10)],
    [v3( 10,   0,   0)],
  ].forEach(([pos], i) => {
    const l = new B.PointLight("light" + i, pos, scene);
    l.radius = 5;
  });

  const renderScene = () => scene.render()
  engine.runRenderLoop(renderScene);

  const resizeEngine = () => engine.resize();
  window.addEventListener("resize", resizeEngine);

  return () => {
    window.removeEventListener("resize", resizeEngine);
    engine.stopRenderLoop(renderScene);
    engine.dispose();
    canvas.removeEventListener("wheel", noBubble);  
  };
}

const standardMaterial = (
  name: string, props: Partial<B.StandardMaterial>, scene: B.Scene,
) =>
  Object.assign(new B.StandardMaterial(name, scene), props);
