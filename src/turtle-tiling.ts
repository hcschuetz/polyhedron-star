// Inspired by https://mathstodon.xyz/@DaniLaura/114658815682032097

import { TAU } from './geom-utils';


function walk(path: Array<string | number>) {
  const p = 1/6, q = Math.sqrt(3)/18;
  // x and y are represented as linear combinations of p and q
  // where the coefficients happen to be integers.
  let xp = 0, xq = 0;
  let yp = 0, yq = 0;
  const currentPos = (): Point2D => [
    xp * p + xq * q,
    yp * p + yq * q,
  ];
  const step = (dxp: number, dxq: number, dyp: number, dyq: number) => {
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

export function drawTurtles(ctx: CanvasRenderingContext2D, sameColor: boolean) {
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
    for (const off of offsets) {
      // Fill full turtle (for head, hands, and feet):
      ctx.fillStyle = sameColor ? "#ff8" : color1;
      ctx.lineWidth = .01
      makePath(list, off, mapPoint);
      ctx.fill();

      // Fill the shell:
      ctx.fillStyle = sameColor ? "#ee0" : color2;
      makePath(shell, off, mapPoint);
      ctx.fill();

      // Turtle outline:
      ctx.lineWidth = .01
      makePath(list, off, mapPoint);
      ctx.stroke();

      // Eyes:
      ctx.fillStyle = "#000";
      const sides =
        ["lHead", "rHead"].map(name => transform(named[name], off, mapPoint));
      for (const [[ax, ay], [bx, by]] of [sides, sides.toReversed()]) {
        ctx.beginPath();
        ctx.arc(.7*ax + .3*bx, .7*ay + .3*by, .02, 0, TAU);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}
