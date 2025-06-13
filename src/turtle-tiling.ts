// Inspired by https://mathstodon.xyz/@DaniLaura/114658815682032097

// But we rotate the image to the right by 30° so that
// red turtles look upward, orange ones downward, green ones left and
// blue ones right.

import * as B from '@babylonjs/core';
import { TAU } from './geom-utils';


function walk(path) {
  const p = 1/6, q = Math.sqrt(3)/18;
  // x and y are represented as linear combinations of p and q
  // where the coefficients happen to be integers.
  let xp = 0, xq = 0;
  let yp = 0, yq = 0;
  const currentPos = (): Point2D => [
    xp * p + xq * q,
    yp * p + yq * q,
  ];
  const step = (dxp, dxq, dyp, dyq) => {
    xp += dxp; xq += dxq;
    yp += dyp; yq += dyq;
  };

  const list = new Array<Point2D>;
  const named = {} as Record<string, Point2D>;

  for (const elem of path) {
    switch (typeof elem) {
      case "string": {
        const pos = currentPos();
        list.push(pos);
        named[elem] = pos;
        break;
      }
      case "number": {
        switch ((elem + 360) % 360) {
          // All edge directions are multiples of 30°.
          // Horizontal and vertical edges are short, all other edges are long.
          case   0: step(+2, -2,  0,  0); break;
          case  30: step(+1,  0,  0, +1); break;
          case  60: step( 0, +1, +1,  0); break;
          case  90: step( 0,  0, +2, -2); break;
          case 120: step( 0, -1, +1,  0); break;
          case 150: step(-1,  0,  0, +1); break;
          case 180: step(-2, +2,  0,  0); break;
          case 210: step(-1,  0,  0, -1); break;
          case 240: step( 0, -1, -1,  0); break;
          case 270: step( 0,  0, -2, +2); break;
          case 300: step( 0, +1, -1,  0); break;
          case 330: step(+1,  0,  0, -1); break;
          default: throw `unsupported angle: ${elem}°`;
        }
        break;
      }
      default: throw "bad path element";
    }
  }
  return {list, named};
}

// Walk around a green turtle, starting at the "4-right-eyes point":
const {list, named} = walk([
  'rHead', // 4-eyes point
  -120, 'nose',
  - 60, 'lHead',
  + 30, 'lNeck',
  - 30, 'lShoulder',
  -120, 'lHandA',
  - 60, 'lHandB',
  + 30, 'lHandC',
  + 90, 'lWaist',
  + 30, 'lHip',
  - 60, 'lFootA',
     0, 'lFootB',
  + 60, 'lFootC',
  +150, 'lTail',
  + 90, 'rTail',
  + 30, 'rFootC', // 4-feet point
  +120, 'rFootB',
   180, 'rFootA',
  +240, 'rHip',
  +150, 'rWaist',
  + 90, 'rHandC',
  +150, 'rHandB',
  +240, 'rHandA',
  +300, 'rShoulder',
  +210, 'rNeck',
  // +150, 'rHeadBack', // 4-eyes point
]);

const shell =
  "rNeck rWaist rTail lTail lWaist lNeck".split(" ")
  .map(name => named[name]);

type Color = string;
type Point2D = [number, number];
type MapPoint2D = (p: Point2D) => Point2D;

const turtles = [
  ["#8f8", "#0d0", [[0,1], [-.5,.5]], ([x, y]) => [+x, +y]],
  ["#88f", "#00f", [[0,0], [+.5,.5]], ([x, y]) => [-x, -y]],
  ["#f88", "#f00", [[0,0], [-.5,.5]], ([x, y]) => [-y, +x]],
  ["#ff8", "#ee0", [[0,1], [+.5,.5]], ([x, y]) => [+y, -x]],
] as Array<[Color, Color, Array<Point2D>, MapPoint2D]>;

export function drawTurtles(ctx: B.ICanvasRenderingContext, bw: boolean) {
  ctx.strokeStyle = "#000";

  function transform(
    point: Point2D,
    [xOff, yOff]: Point2D,
    mapPoint: MapPoint2D,
  ): Point2D {
      // It's a bit strange, but at least it is in a single place now.
      const [xm, ym] = mapPoint(point);
      const xx = xOff + xm/2, yy = yOff + ym/2;
      return [xx + yy, yy - xx];
  }

  function makePath(
    path: Array<Point2D>,
    off: Point2D,
    mapPoint: MapPoint2D,
  ) {
    ctx.beginPath();
    path.forEach((point, i) => {
      const [x, y] = transform(point, off, mapPoint);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }

  for (const [color1, color2, offsets, mapPoint] of turtles) {
    ctx.fillStyle = bw ? "#ccc" : color1;
    ctx.lineWidth = .01
    for (const off of offsets) {
      makePath(list, off, mapPoint);
      // Why does BabylonJS use its own type instead of CanvasRenderingContext2D?
      (ctx as CanvasRenderingContext2D).fill('evenodd');
    }
    ctx.fillStyle = bw ? "#888" : color2;
    ctx.lineWidth = .005
    for (const off of offsets) {
      makePath(shell, off, mapPoint);
      // Why does BabylonJS use its own type instead of CanvasRenderingContext2D?
      (ctx as CanvasRenderingContext2D).fill('evenodd');
    }
  }
  for (const [,, offsets, map] of turtles) {
    ctx.lineWidth = .01
    for (const off of offsets) {
      // Outline:
      makePath(list, off, map);
      ctx.stroke();

      // Eyes:
      const [xxxl, yyyl] = transform(named.lHead, off, map);
      const [xxxr, yyyr] = transform(named.rHead, off, map);

      ctx.fillStyle = "#000";
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D).arc(
        2/3*xxxl + 1/3*xxxr,
        2/3*yyyl + 1/3*yyyr,
        .02,
        0, TAU,
      );
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      (ctx as CanvasRenderingContext2D).arc(
        1/3*xxxl + 2/3*xxxr,
        1/3*yyyl + 2/3*yyyr,
        .02,
        0, TAU,
      );
      ctx.closePath();
      ctx.fill();
    }
  }
}
