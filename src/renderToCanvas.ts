import 'es-iterator-helpers/auto'; // shims for Safari
import * as B from '@babylonjs/core';
import { Vector2 as V2, Vector3 as V3 } from '@babylonjs/core';
import * as G from '@babylonjs/gui';

import { assert, fail } from './utils';
import { angleToRad, Task, stepToV2, Step } from './taskspec';
import { arcPath, interpolateV2, intersectLineSegments, rotateAroundInPlace, TAU, UVFrame, v2, v3 } from './geom-utils';
import { batch, computed, effect, Signal } from '@preact/signals';
import { Edge, EdgeBreak, HalfEdge, Loop, loopHalfEdges, makeSegment, Vertex } from './Shape';
import computeBends from './computeBends';
import { Grid3Background, Grid3Feature, Grid4Background, Grid4Feature, GridConfig, grids, GridType, makeTexture } from './tiling';


type GridSignals = {
  grid: Signal<GridType>,
  grid3: Record<Grid3Feature, Signal<boolean>> & {background: Signal<Grid3Background>},
  grid4: Record<Grid4Feature, Signal<boolean>> & {background: Signal<Grid4Background>},
};

function gridSignalsToConfig(signals: GridSignals): GridConfig {
  const {grid, grid3, grid4} = signals;
  return {
    grid: grid.value,
    grid3: {
      background: grid3.background.value,
      triangles: grid3.triangles.value,
      diamonds: grid3.diamonds.value,
      hexagons1: grid3.hexagons1.value,
      hexagons2: grid3.hexagons2.value,
      arrows: grid3.arrows.value,
      ball: grid3.ball.value,
      zigzag: grid3.zigzag.value,
    },
    grid4: {
      background: grid4.background.value,
      quads: grid4.quads.value,
    },
  }
}

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
  density: Signal<number>,
} & GridSignals;

export default function renderToCanvas(
  canvas: HTMLCanvasElement,
  task: Task,
  signals: Signals,
  emitWarning: (warning: string) => void,
) {
  const gaps = Object.entries(task.starGaps).map(([name, gap]) => {
    if (typeof gap === "string") {
      // expand abbreviated notation:
      const parts = gap.trim().split(/ +/);
      const angleDeficit = parts.pop();
      gap = {angleDeficit, steps: parts as Step[]};
    }
    return {...gap, name};
  });
  const gapIndex = new Map(gaps.map(({name}, i) => [name, i]));

  const primaryVertices = new Array<Vertex>();

  let pos = V2.Zero();
  let totalAngleDeficit = 0;
  gaps.forEach(({name, angleDeficit, steps}, i, array) => {
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
  if (pos.length() > 1e-8) {
    emitWarning(`The polygon around the star is not closed. Offset: (${pos.x}, ${pos.y})`);
  }
  const remainingAngleDeficit = 2*TAU - totalAngleDeficit;
  console.log(
    `Total angle deficit: ${totalAngleDeficit} = ${
      (totalAngleDeficit*(360/TAU)).toFixed(5)
    }°\nremaining:           ${remainingAngleDeficit} = ${
      (remainingAngleDeficit*(360/TAU)).toFixed(5)}°`
  );

  const vertices: Vertex[] = primaryVertices.slice();
  const edges: Edge[] = [];
  for (let e of task.edges) {
    if (typeof e === "string" && e.includes(" ")) {
      // expand abbreviated notation:
      const parts = e.trim().split(/ +/);
      const from = parts.shift();
      const bend = parts.pop();
      const to = parts.pop();
      e = {from, to, through: parts, bend}
    }
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
      const {from, to, through = [], bend} = e;
      const fromIndex = gapIndex.get(from);
      const fromVertex = primaryVertices[2*fromIndex];
      const fromPos = fromVertex.pos2D;
      const toVertex = primaryVertices[2*gapIndex.get(to)];
      const bendAngle = angleToRad(bend);

      let toPosRotated = toVertex.pos2D.clone();
      const rotations: {index: number, inner: V2, outer: V2}[] = [];
      for (const thr of through.toReversed()) {
        const index = gapIndex.get(thr);
        const pivot = primaryVertices[2*index].pos2D;
        const angleDefNeg = -angleToRad(gaps[index].angleDeficit);
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
        if (lambda_p < 1e-8 || lambda_p > 1 - 1e-8) {
          throw `edge ${from}-${to} does not pass through gap ${through[i]}`;
        }
        if (lambda_q < 1e-8 || lambda_q > 1 - 1e-8) {
          throw `edge ${from}-${to} does not reach gap ${through[i]}`;
        }
        const pivot = primaryVertices[2*index];
        const v0: Vertex = {
          name: `${fromVertex.name}<${toVertex.name}#${pivot.name}`,
          pos1D: 2*index - lambda_p,
          pos2D: interpolateV2(
            pivot.pos2D,
            primaryVertices.at(2*index-1).pos2D,
            lambda_p,
          ),
        };
        const v1: Vertex = {
          name: `${fromVertex.name}>${toVertex.name}#${pivot.name}`,
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

  {
    const nVertices = gaps.length + 1;
    const nEdges = edges.length;
    const nEdgesExpected = 3 * (nVertices -2);
    if (nEdges !== nEdgesExpected) {
      emitWarning(
        `For ${nVertices} vertices (${gaps.length} gaps + 1 cut center) ` +
        `autobend expects ${nEdgesExpected} edges, but ${nEdges} edges were provided.`
      );
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
    do {
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
      if (++count > 200) { throw "runaway iteration"; }
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
    emitWarning,
  );

  // ---------------------------------------------------------------------------

  const colors = {
    inner: B.Color3.Blue(),
    outer: B.Color3.Red(),
    secondary: B.Color3.Green(),

    cut: B.Color3.Red(),
    edge: B.Color3.Green(),
    break: B.Color3.Green(),
    flower: B.Color3.Red(),

    face: B.Color3.Yellow(),

    grid: B.Color3.Black(),
  };

  const engine = new B.Engine(canvas, true);
  const scene = new B.Scene(engine);
  const renderScene = () => scene.render()
  const resizeEngine = () => engine.resize();

  const effectDisposers: (() => void)[] = [];

  function disposableEffect(fn: () => void): void {
    effectDisposers.push(effect(fn));
  }

  const cleanup = () => {
    for (const dispose of effectDisposers.reverse()) {
      dispose();
    }
    window.removeEventListener("resize", resizeEngine);
    engine.stopRenderLoop(renderScene);
    engine.dispose();
  }

  try {
    scene.clearColor = new B.Color4(0,0,0,0);

    const advancedTexture = G.AdvancedDynamicTexture.CreateFullscreenUI("myUI", true, scene);
    advancedTexture.rootContainer.scaleX = window.devicePixelRatio;
    advancedTexture.rootContainer.scaleY = window.devicePixelRatio;

    const makeVertex = (kind: string) =>
      Object.assign(
        B.MeshBuilder.CreateIcoSphere("vertex_" + kind, {
          radius: .03,
          subdivisions: 3,
          flat: false,
        }, scene), {
          material: standardMaterial("vertexMaterial_" + kind, {
            diffuseColor: colors[kind],
          }, scene),
          isVisible: false,
        }
      );
    const vertexPatterns = {
      inner: makeVertex("inner"),
      outer: makeVertex("outer"),
      secondary: makeVertex("secondary"),
    }

    const faceMaterial = standardMaterial("faceMaterial", {
      roughness: 100,
      specularColor: B.Color3.White().scale(.5),
      sideOrientation: B.VertexData.DOUBLESIDE,
      backFaceCulling: false,
    }, scene);

    disposableEffect(() => {
      const oldTexture = faceMaterial.diffuseTexture;
      faceMaterial.diffuseTexture = makeTexture(gridSignalsToConfig(signals));
      // Disposing *after* setting the new texture to avoid flickering:
      oldTexture?.dispose(); // Is this actually needed?
    });

    const flowerMaterial = standardMaterial("flowerMaterial", {
      diffuseColor: colors.flower,
    }, scene);

    const cutMaterial = standardMaterial("cutMaterial", {
      diffuseColor: colors.cut,
    }, scene);

    const edgeMaterial = standardMaterial("edgeMaterial", {
      diffuseColor: colors.edge,
    }, scene);

    const breakMaterial = standardMaterial("breakMaterial", {
      diffuseColor: colors.break,
    }, scene);


    // 3D positions are not stored in the vertices but in a computed map
    // so that they can be changed in a single transaction.
    const pos3DMapSignal = computed(() =>
      makePos3DMap(signals.bending.value, signals.autobend.value)
    );

    vertices.values().forEach(v => {
      const pos1DMod2 = v.pos1D % 2;
      const patternName =
        pos1DMod2 === 0 ? "inner" :
        pos1DMod2 === 1 ? "outer" :
        "secondary";
      const instance = vertexPatterns[patternName].createInstance(v.name);
      disposableEffect(() => {
        instance.position = pos3DMapSignal.value.get(v);
        instance.setEnabled(signals.vertices.value);
        // Or use this:?
        // instance.isVisible = signals.vertices.value;
      });
    });
    primaryVertices.forEach((v, i) => {
      if (i % 2 !== 0) return;
      {
        const labelPos = new B.TransformNode("labelPos" + i, scene);
        disposableEffect(() => {
          labelPos.position = pos3DMapSignal.value.get(v);
        });
        const label = new G.TextBlock("label" + i, v.name);
        disposableEffect(() => { label.isVisible = signals.labels.value; });
        label.color = "#fff";
        label.fontSize = 16;
        label.linkOffsetY = -10;
        advancedTexture.addControl(label);
        label.linkWithMesh(labelPos);
      }
      dynamicTube(`flower${i}`, {
        radius: .005,
        pathProvider: () => arcPath(
          pos3DMapSignal.value.get(v),
          pos3DMapSignal.value.get(primaryVertices.at(i-1)),
          pos3DMapSignal.value.get(primaryVertices[i+1]),
          20,
        ),
        show: signals.flower,
        disposableEffect,
      }, {
        material: flowerMaterial
      }, scene);
    });
    for (const cut of cuts) {
      dynamicTube("cut", {
        radius: .01,
        pathProvider: () => [
          pos3DMapSignal.value.get(cut.twin.to),
          pos3DMapSignal.value.get(cut.to)
        ],
        show: signals.cuts,
        disposableEffect,
      }, {
        material: cutMaterial,
      }, scene);
    }
    for (const {segments} of edges) {
      for (const {twin: {to: from}, to} of segments) {
        dynamicTube("seg", {
          radius: .015,
          pathProvider: () => [
            pos3DMapSignal.value.get(from),
            pos3DMapSignal.value.get(to),
          ],
          show: signals.edges,
          disposableEffect,
        }, {
          material: edgeMaterial,
        }, scene);
      }
    }
    for (const {breaks} of edges) {
      for (const {from, to, pivot} of breaks) {
        dynamicTube("arc", {
          radius: .005,
          pathProvider: () => arcPath(
            pos3DMapSignal.value.get(pivot),
            pos3DMapSignal.value.get(from),
            pos3DMapSignal.value.get(to),
            10
          ),
          show: signals.breaks,
          disposableEffect,
        }, {
          material: breakMaterial,
        }, scene);
      }
    }
    {
      const mesh = Object.assign(new B.Mesh("faces", scene), {
        material: faceMaterial,
      });
      disposableEffect(() => { mesh.setEnabled(signals.faces.value);  });
      disposableEffect(() => {
        const {uvFunc} = grids[signals.grid.value];

        const positions = new Array<number>();
        const uvs1 = new Array<number>();
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
            uvs1.push(
              ...uvFunc(pivot.pos2D),
              ...uvFunc(current.twin.to.pos2D),
              ...uvFunc(current.to.pos2D),
            )
            indices.push(i++, i++, i++);
          }
        }
        const density = signals.density.value;
        const uvs = uvs1.map(val => density * val);

        // TODO: update positions and uvs independently
        // (positions whenever the bending and thus the pos3DMapSignal changes;
        // uvs whenever the grid type or density changes.)
        const vertexData = Object.assign(new B.VertexData(), {
          positions, uvs, indices,
        });
        vertexData.applyToMesh(mesh);
      });
    }

    const camera = Object.assign(
      new B.ArcRotateCamera("camera", -TAU/4, TAU/4, 10, v3(0, 0, 0), scene), {
        lowerRadiusLimit: 3,
        upperRadiusLimit: 30,
        zoomToMouseLocation: true,
      }
    );
    camera.attachControl(canvas, false);

    [ // tetrahedral directions
      [ 1,  1,  1], [ 1, -1, -1],
      [-1,  1, -1], [-1, -1,  1],
    ].forEach((dir, i) => {
      const hl = new B.HemisphericLight("hemisphericLight" + i, v3(...dir), scene);
      hl.intensity = .6;

      // point lights come from the opposite directions:
      const pl = new B.PointLight("pointLight" + i, v3(...dir).scaleInPlace(-100), scene);
      pl.radius = 50;
    })
    
    new B.HemisphericLight("hemisphLight1", v3(0,0,-100), scene);

    engine.runRenderLoop(renderScene);
    window.addEventListener("resize", resizeEngine);

    // -------------------------------------------------------------------------

    // TODO Figure out why setting the signals (actually signal.grid) earlier
    // leads to an exception due to an undefined context in the DynamicTexture.
    // Then maybe move the signals-setting up to avoid unnecessary effect
    // re-evaluation.
    // Or treat grid type and grid density as manifold properties rather than
    // display properties?  So they would no more be (GUI-modifiable) signals.

    batch(() => {
      function setSignal<T>(signal: Signal<T>, value: T | undefined) {
        if (value !== undefined) signal.value = value;
      }

      const {display} = task;
      const {grid3, grid4} = display;

      setSignal(signals.vertices, display.vertices);
      setSignal(signals.labels, display.labels);
      setSignal(signals.edges, display.edges);
      setSignal(signals.cuts, display.cuts);
      setSignal(signals.faces, display.faces);
      setSignal(signals.breaks, display.breaks);
      setSignal(signals.flower, display.flower);
      setSignal(signals.bending, display.bending);
      setSignal(signals.autobend, display.autobend);
      setSignal(signals.grid, display.grid);
      setSignal(signals.density, display.density);
      if (grid3) {
        const grid3Signals = signals.grid3;
        setSignal(grid3Signals.background, grid3.background);
        setSignal(grid3Signals.triangles, grid3.triangles);
        setSignal(grid3Signals.diamonds, grid3.diamonds);
        setSignal(grid3Signals.hexagons1, grid3.hexagons1);
        setSignal(grid3Signals.hexagons2, grid3.hexagons2);
        setSignal(grid3Signals.arrows, grid3.arrows);
        setSignal(grid3Signals.ball, grid3.ball);
        setSignal(grid3Signals.zigzag, grid3.zigzag);
      }
      if (grid4) {
        const grid4Signals = signals.grid4;
        setSignal(grid4Signals.background, grid4.background);
        setSignal(grid4Signals.quads, grid4.quads);
      }
    });
  } catch(error) {
    emitWarning(`In renderToCanvas(...): ${error}`);
  } finally {
    return cleanup;
  }
}

const standardMaterial = (
  name: string, props: Partial<B.StandardMaterial>, scene: B.Scene,
) =>
  Object.assign(new B.StandardMaterial(name, scene), props);

function dynamicTube(
  name: string,
  options: {
    pathProvider: () => V3[],
    radius?: number,
    show: Signal<boolean>,
    disposableEffect: (fn: () => void) => void,
  },
  props: Partial<B.Mesh>,
  scene: B.Scene,
) {
  const {radius, pathProvider, show, disposableEffect} = options;
  let instance: B.Mesh;

  disposableEffect(() => {
    try {
      instance = B.MeshBuilder.CreateTube(name, {
        updatable: true,
        instance,
        path: pathProvider(),
        radius,
      }, scene);
      Object.assign(instance, props);
      instance.setEnabled(show.value);
    } catch (e) {
      if (e instanceof TypeError && e.message === "positions2 is null") {
        // This error is occasionally thrown from CreateTube.
        // (Is this a bug in BabylonJS or am I doing something wrong?)
        // Looks like we can simply ignore it.
        return;
      }
      // Otherwise rethrow the unknown error (but Preact's signal handling
      // probably also ignores it).
      throw e;
    }
  });

  return instance;
}
