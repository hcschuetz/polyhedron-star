import * as B from '@babylonjs/core';
import { Vector2 as V2, Vector3 as V3 } from '@babylonjs/core';
import * as G from '@babylonjs/gui';
import JSON5 from 'json5';

import { assert, fail } from './utils';
import { angleToRad, Task, stepToV2 } from './taskspec';
import { arcPath, interpolateV2, intersectLineSegments, rotateAroundInPlace, TAU, UVFrame, v2, v3 } from './geom-utils';
import { computed, effect, Signal } from '@preact/signals';
import { Edge, EdgeBreak, HalfEdge, Loop, loopHalfEdges, makeSegment, Vertex } from './Shape';
import computeBends from './computeBends';


export type Signals = {
  bending: Signal<number>,
  autobend: Signal<boolean>,
  vertices: Signal<boolean>,
  labels: Signal<boolean>,
  edges: Signal<boolean>,
  cuts: Signal<boolean>,
  faces: Signal<boolean>,
  breaks: Signal<boolean>,
  flower: Signal<boolean>,
}

export default function renderToCanvas(
  canvas: HTMLCanvasElement,
  taskString: string,
  signals: Signals,
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
        breaks: [],
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
      const segments = new Array<HalfEdge>();
      const breaks: EdgeBreak[] = rotations.map(({index, inner, outer}, i) => {
        const [np, nq, d] = intersectLineSegments(inner, outer, fromPos, toPosRotated);
        const lambda_p = np / d;
        const lambda_q = nq / d;
        if (lambda_p < 1e-8 || lambda_p > 1 - 1e-8) console.error(
          `edge ${from}-${to} does not pass through gap ${through[i]}`
        );
        if (lambda_q < 1e-8 || lambda_q > 1 - 1e-8) console.error(
          `edge ${from}-${to} does not reach gap ${through[i]}`
        );
        const pivot = primaryVertices[2*index];
        const v0: Vertex = {
          name: `${pivot.name}#${fromVertex.name}<${toVertex.name}`,
          pos1D: 2*index - lambda_p,
          pos2D: interpolateV2(
            pivot.pos2D,
            primaryVertices.at(2*index-1).pos2D,
            lambda_p,
          ),
        };
        const v1: Vertex = {
          name: `${pivot.name}#${fromVertex.name}>${toVertex.name}`,
          pos1D: 2*index + lambda_p,
          pos2D: interpolateV2(
            pivot.pos2D,
            primaryVertices[(2*index+1) % primaryVertices.length].pos2D,
            lambda_p
          ),
        };
        vertices.push(v0, v1);
        segments.push(makeSegment(prevVertex, v0));

        prevVertex = v1;
        return {from: v0, to: v1, pivot, lambda: lambda_q};
      });
      segments.push(makeSegment(prevVertex, toVertex));
      edges.push({
        from: fromVertex,
        to: toVertex,
        alongCut: false,
        length,
        bendAngle,
        segments,
        breaks,
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
      he.userBend = bendAngle;
      he.twin.userBend = bendAngle;
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

  function makePos3DMap(bending: number, useAutoBend: boolean) {
    const result = new Map<Vertex, V3>();

    function bendEdges(he: HalfEdge, frame: UVFrame) {
      const {twin, to} = he;
      const from3D = frame.injectPoint(twin.to.pos2D);
      const to3D   = frame.injectPoint(to.pos2D);
      result.set(to, to3D);

      if (twin.loop === boundary) return;
      const bend = useAutoBend ? he.computedBend : he.userBend;
      const newFrame =
        frame.rotateAroundLine(from3D, to3D, bend * bending);
      for (let heTmp = twin.next; heTmp !== twin; heTmp = heTmp.next) {
        bendEdges(heTmp, newFrame);
      }
    }

    loopHalfEdges(centerFace).forEach(he => bendEdges(he, starFrame));

    return result;
  }

  computeBends(
    primaryVertices,
    makePos3DMap(1, false),
    edges,
    centerFace,
    boundary,
    1000,
    1e-16,
  );

  // 3D positions are not stored in the vertices but in a computed map signal
  // dependent on the bending signal.
  const pos3DMapSignal = computed(() =>
    makePos3DMap(signals.bending.value, signals.autobend.value)
  );

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
    primaryVertices.forEach((v, i) => {
      const instance = vertexPatterns[i % 2].createInstance(v.name);
      effect(() => {
        instance.position = pos3DMapSignal.value.get(v);
        instance.setEnabled(signals.vertices.value);
        // Or use this:?
        // instance.isVisible = signals.vertices.value;
      });
    });
  }
  {
    primaryVertices.forEach((v, i) => {
      if (i % 2 !== 0) return;
      {
        const labelPos = new B.TransformNode("labelPos" + i, scene);
        effect(() => {
          labelPos.position = v3(0, .2, 0).addInPlace(pos3DMapSignal.value.get(v));
        });
        const label = new G.TextBlock("label" + i, v.name);
        effect(() => { label.isVisible = signals.labels.value; });
        label.color = "#fff";
        label.fontSize = 16;
        advancedTexture.addControl(label);
        label.linkWithMesh(labelPos);
      }
      {
        dynamicGreasedLine(`flower${i}`, {
          width: .01,
          color: colors.flower,
        }, scene, () => arcPath(
          pos3DMapSignal.value.get(v),
          pos3DMapSignal.value.get(primaryVertices.at(i-1)),
          pos3DMapSignal.value.get(primaryVertices[i+1]),
          20,
        ),
        signals.flower,
      );
      }
    });
  }
  if (!false) {
    for (const cut of cuts) {
      dynamicGreasedLine("cut", {
        width: .01,
        color: colors.cut,
      }, scene, () => [
        pos3DMapSignal.value.get(cut.twin.to),
        pos3DMapSignal.value.get(cut.to)
      ], signals.cuts);
    }
  }
  {
    for (const {segments} of edges) {
      for (const {twin: {to: from}, to} of segments) {
        dynamicGreasedLine(
          "seg", {
            width: .03,
            color: colors.edge,
          },
          scene,
          () => [pos3DMapSignal.value.get(from), pos3DMapSignal.value.get(to)],
          signals.edges
        );
      }
    }
    for (const {breaks} of edges) {
      for (const {from, to, pivot} of breaks) {
        dynamicGreasedLine("arc", {
          width: .01,
          color: colors.edge,
        }, scene, () => arcPath(
          pos3DMapSignal.value.get(pivot),
          pos3DMapSignal.value.get(from),
          pos3DMapSignal.value.get(to),
          10
        ), signals.breaks);
      }
    }
  }
  // if (showFaces)
  {
    const mesh = Object.assign(new B.Mesh("faces", scene), {
      material: faceMaterial,
    });
    effect(() => { mesh.setEnabled(signals.faces.value);  });
    effect(() => {
      const positions = new Array<number>();
      const indices = new Array<number>();
      let i = 0;
      for (const face of subfaces) {
        if (face === boundary) continue;
        const [first, second, ...rest] = loopHalfEdges(face);
        const pivot = first.to;
        assert (second.twin.to === pivot);
        for (const current of rest) {
          positions.push(
            ...pos3DMapSignal.value.get(pivot).asArray(),
            ...pos3DMapSignal.value.get(current.twin.to).asArray(),
            ...pos3DMapSignal.value.get(current.to).asArray(),
          );
          indices.push(i++, i++, i++);
        }
      }

      const vertexData = Object.assign(new B.VertexData(), {positions, indices});
      vertexData.applyToMesh(mesh);
    });
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

function dynamicGreasedLine(
  name: string,
  mbo: B.GreasedLineMaterialBuilderOptions,
  scene: B.Scene,
  dataFn: () => V3[],
  show: Signal<boolean>,
) {
  let line = B.CreateGreasedLine(
    name, {updatable: true, points: dataFn()}, mbo, scene,
  );

  effect(() => {
    // This approach for updating a greased line is not documented in
    // https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/param/greased_line/
    // as it is not specific to greased lines but (in principle) applicable
    // to any mesh.
    // But there is a link to a playground example, which I'm following:
    // https://playground.babylonjs.com/#ZRZIIZ#98
    const positions = line.getVerticesData(B.VertexBuffer.PositionKind);
    if (!positions) return;
    let j = 0;
    for (const {x,y,z} of dataFn()) {
      // The points are duplicated (and of course flattened) into positions:
      positions[j++] = x; positions[j++] = y; positions[j++] = z;
      positions[j++] = x; positions[j++] = y; positions[j++] = z;
    }
    line.setEnabled(show.value);
    line.updateVerticesData(B.VertexBuffer.PositionKind, positions);
  });

  return line;
}
