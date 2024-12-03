import * as B from '@babylonjs/core';
import { Vector2 as V2, Vector3 as V3 } from '@babylonjs/core';
import * as G from '@babylonjs/gui';
import JSON5 from 'json5';

import { assert, fail } from './utils';
import { angleToRad, Task, stepToV2 } from './taskspec';
import triangulate from './triangulate';
import { arcPath, interpolateV2, intersectLineSegments, rotateAroundInPlace, v2, v2ToV3, v3 } from './geom-utils';

const TAU = 2 * Math.PI;
const r3 = Math.sqrt(3);

type StarVertex = {name: string, pos: V2, isTip: boolean};

type StarBoundaryPoint = {
  gapName: string,
  // between -1 and +1;
  // - negative: along the preceding spike
  // - zero: at the inner vertex
  // - positive: along the subsequent spike
  offset: number,
  pos: V2,
};
type StarEdgeSegment = {from: StarBoundaryPoint, to: StarBoundaryPoint};
type StarEdge = {
  angle: number,
  length: number,
  segments: StarEdgeSegment[],
};

export default function renderToCanvas(
  canvas: HTMLCanvasElement,
  taskString: string,
) {
  const task: Task = JSON5.parse(taskString);

  // ---------------------------------------------------------------------------

  const starIndex = new Map(task.star.gaps.map((v, i) => [v.name, i]));

  const star: StarVertex[] = [];
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
    star.push(
      {name, pos: inner, isTip: false},
      {name: `${name}^${array[(i+1)%array.length]}`, pos, isTip: true},
    );
  });
  console.log(
    `Total angle deficit: ${totalAngleDeficit} = ${
      (totalAngleDeficit*(360/TAU)).toFixed(5)
    }°`
  );

  const starEdges: StarEdge[] = [];
  for (const e of task.edges) {
    if (typeof e === "string") {
      const index = starIndex.get(e);
      const length = star[2*index].pos.subtract(star.at(2*index-1).pos).length();
      // TODO remove one of the segments?
      starEdges.push({angle: 0, length, segments: [{
        from: {gapName: e, offset:  0, pos: star[2*index].pos},
        to  : {gapName: e, offset: +1, pos: star[(2*index+1) % star.length].pos},
      }, {
        from: {gapName: e, offset: -1, pos: star.at(2*index-1).pos},
        to  : {gapName: e, offset:  0, pos: star[2*index].pos},
      }]});
    } else {
      const {from, to, through = []} = e;
      const toPos = star[2*starIndex.get(to)].pos;
      let toRot = toPos.clone();
      const rotHistory: {name: string, from: V2, to: V2}[] = [];
      for (const thr of through.toReversed()) {
        const index = starIndex.get(thr);
        const pivot = star[2*index].pos;
        const angleDefNeg = -angleToRad(task.star.gaps[index].angleDeficit);
        rotateAroundInPlace(toRot, pivot, angleDefNeg);
        for (const {from, to} of rotHistory) {
          rotateAroundInPlace(from, pivot, angleDefNeg);
          rotateAroundInPlace(to, pivot, angleDefNeg);
        }
        rotHistory.unshift({name: thr, from: pivot.clone(), to: star.at(2*index-1).pos.clone()});
      }
      const fromIndex = starIndex.get(from);
      const fromPos = star[2*fromIndex].pos;
      const length = toRot.subtract(fromPos).length();

      let prevIndex = fromIndex;
      let prevName = task.star.gaps[fromIndex].name;
      let prevLambda = 0;
      const segments = rotHistory.map(({name, from, to}) => {
        const index = starIndex.get(name);
        const [np,, d] = intersectLineSegments(from, to, fromPos, toRot);
        const lambda = np / d;
        if (lambda < 1e-8 || lambda > 1 - 1e-8) console.error(
          `edge ${e.from}-${e.to} does not pass through gap ${name}`
        );
        const seg = {
          from: {gapName: prevName, offset: prevLambda,
            pos: interpolateV2(star[2*prevIndex].pos, star[(2*prevIndex+1) % star.length].pos, prevLambda)},
          to  : {gapName: name    , offset: lambda    ,
            pos: interpolateV2(star[2*index].pos, star.at(2*index-1).pos, lambda)},
        };
        prevIndex = index;
        prevName = name;
        prevLambda = lambda;
        return seg;
      });
      segments.push({
        from: {gapName: prevName, offset: prevLambda,
          pos: interpolateV2(star[2*prevIndex].pos, star.at(2*prevIndex+1).pos, prevLambda)},
        to  : {gapName: to      , offset: 0,
          pos: toPos},
      });
      starEdges.push({angle: angleToRad(e.angle), length, segments});
    }
  }

  // ---------------------------------------------------------------------------

  const noBubble = (e: Event) => e.preventDefault();
  canvas.addEventListener("wheel", noBubble);

  const engine = new B.Engine(canvas, true);
  const scene = new B.Scene(engine);

  const advancedTexture = G.AdvancedDynamicTexture.CreateFullscreenUI("myUI", true, scene);
  advancedTexture.rootContainer.scaleX = window.devicePixelRatio;
  advancedTexture.rootContainer.scaleY = window.devicePixelRatio;
  
  const edgeMaterial = standardMaterial("edgeMaterial", {
    diffuseColor: B.Color3.Green(),
  }, scene);

  const arcMaterial = standardMaterial("arcMaterial", {
    diffuseColor: B.Color3.Green(),
    transparencyMode: B.Material.MATERIAL_ALPHABLEND,
    alpha: .5,
  }, scene);

  const tipMaterial = standardMaterial("tipMaterial", {
    diffuseColor: B.Color3.Red(),
  }, scene);

  const innerMaterial = standardMaterial("innerMaterial", {
    diffuseColor: B.Color3.Blue(),
  }, scene);

  const faceMaterial = standardMaterial("faceMaterial", {
    diffuseColor: B.Color3.Yellow(),
    roughness: 100,
    transparencyMode: B.Material.MATERIAL_ALPHABLEND,
    alpha: 0.6,
    // wireframe: true,
    sideOrientation: B.VertexData.DOUBLESIDE,
    backFaceCulling: false,
  }, scene);

  const gridMaterial = standardMaterial("gridMaterial", {
    diffuseColor: B.Color3.Black(),
  }, scene);

  const starCenter = star
    .reduce((acc, vtx) => acc.addInPlace(vtx.pos), V2.Zero())
    .scaleInPlace(1 / star.length);

  const root = new B.TransformNode("root", scene);
  root.position = v2ToV3(starCenter.negate());

  // if (showVertices) {
    star.forEach(({name, pos}, i) => {
      const ball = B.MeshBuilder.CreateIcoSphere("vtx" + i, {radius: .05});
      ball.position = v2ToV3(pos);
      ball.parent = root;
      ball.material = name.includes("^") ? tipMaterial : innerMaterial;
    });
  // }
  // if (showVertexNames) {
    star.forEach(({pos, name}, i) => {
      const labelText = name;
      if (labelText.includes("^")) return;
      const labelPos = new B.TransformNode("labelPos" + i, scene);
      labelPos.parent = root;
      labelPos.position = v3(0, .2, 0).addInPlace(v2ToV3(pos));
      const label = new G.TextBlock("label" + i, labelText);
      label.color = "#fff";
      label.fontSize = 16;
      advancedTexture.addControl(label);
      label.linkWithMesh(labelPos);
    });
  // }
  // if (showStarFace)
  {
    const triangles = triangulate(star.map(v => v.pos));
    const mesh = new B.Mesh("triangles", scene);
    const vertexData = new B.VertexData();
    vertexData.positions =
      triangles.flatMap(triangle => triangle.flatMap(v => [v.x, v.y, 0]));
    vertexData.indices =
      Array.from({length: 3*triangles.length}, (_, i) => i);
    vertexData.applyToMesh(mesh);
    mesh.material = faceMaterial;
    mesh.parent = root;
  }
  // if (showStarEdges)
  {
    for (const {segments} of starEdges) {
      for (const {from, to} of segments) {
        Object.assign(
            B.MeshBuilder.CreateTube("seg", {
            path: [v2ToV3(from.pos), v2ToV3(to.pos)],
            radius: .015,
          }, scene), {
          material: edgeMaterial,
          parent: root,
        });
      }
    }
    task.edges.forEach((e, i) => {
      if (typeof e === "string") return;
      if (!e.through) return;
      const edge = starEdges[i];
      e.through.forEach((name, j) => {
        const from = edge.segments[j].to.pos;
        const to = edge.segments[j+1].from.pos;
        const index = starIndex.get(name);
        const center = star[2*index].pos;
        Object.assign(
          B.MeshBuilder.CreateTube("arc", {
            path: arcPath(center, from, to, 10).map(v2ToV3),
            radius: .015,
          }), {
            material: arcMaterial,
            parent: root,
          }
        );
      });
    });

    if (false) for (let i = -12; i < 4; i++) {
      for (const [skewDown, skewUp] of [[0,0], [0.5, 0.5], [-5,+5], [+5,-5]]) {
        const line = B.MeshBuilder.CreateTube("grid", {
          path: [
            v3((i+skewDown)*r3, -5, 0),
            v3((i+skewUp  )*r3, +5, 0),
          ],
          radius: 0.005,
        });
        line.material = gridMaterial;
        line.parent = root;
      }
    }
  }

  const camera = new B.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 10, v3(0, 0, 0), scene);
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 30;
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

  if (false) [[1,0,0], [0,1,0], [0,0,1]].forEach(([x,y,z], i) =>
    Object.assign(
      B.MeshBuilder.CreateTube("axis" + i, {
        path: [new V3(), new V3(x,y,z).scaleInPlace(5)],
        radius: 0.02,
      }, scene), {
      material: standardMaterial("axisMat" + i, {
        diffuseColor: new B.Color3(x,y,z),
      }, scene),
    })
  );

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
