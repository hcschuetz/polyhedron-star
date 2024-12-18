import { Signal } from '@preact/signals';
import * as B from '@babylonjs/core';

import { TAU } from './geom-utils';


// It would be cool to also have Alhambra-style tilings
// (http://www.andalucia360travel.com/en/descubrir/tiles-of-the-alhambra/)
// or M. C. Escher-style creatures.


export type Grid3Feature =
| "subTriangles"
| "triangles"
| "diamonds"
| "hexagons1"
| "hexagons2"
| "arrows"
| "ball"
| "zigzag"
;

const r3 = Math.sqrt(3);

const grid3Painters: Record<Grid3Feature, (ctx: B.ICanvasRenderingContext) => void> = {
  subTriangles(ctx) {
    ctx.fillStyle = "#cc0";
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(2/r3, 0);
    ctx.lineTo(r3/2, 1/2);
    ctx.closePath();
    ctx.fill();
  },
  triangles(ctx) {
    ctx.lineWidth = 1 / 20;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 1);
    ctx.stroke();
  },
  diamonds(ctx) {
    ctx.lineWidth = 1 / 20;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r3*2/3, 0);
    ctx.stroke();
  },
  hexagons1(ctx) {
    ctx.lineWidth = 1 / 20;
    ctx.beginPath();
    ctx.moveTo(2/r3, 0);
    ctx.lineTo(r3/2, 1/2);
    ctx.stroke();
  },
  hexagons2(ctx) {
    ctx.lineWidth = 1 / 20;
    ctx.beginPath();
    ctx.moveTo(r3/3, -1/3);
    ctx.lineTo(r3/3,  1/3);
    ctx.lineTo(r3/2,  1/2);
    ctx.stroke();
  },
  arrows(ctx) {
    ctx.lineWidth = 1 / 40;
    ctx.beginPath();
    ctx.moveTo(.2 ,  .6);
    ctx.lineTo(.2 , 1.4);
    ctx.moveTo(.25, 1.28);
    ctx.lineTo(.2 , 1.4);
    ctx.lineTo(.15, 1.28);
    ctx.stroke();  
  },
  ball(ctx) {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(0, 0, .2, 0, TAU, true);
    ctx.fill();  
  },
  zigzag(ctx) {
    ctx.lineWidth = 1 / 20;
    ctx.beginPath();
    ctx.moveTo(-.1, .45);
    ctx.lineTo( .1, .5 );
    ctx.lineTo(-.1, .8 );
    ctx.lineTo( .1, .85);
    ctx.lineTo(0, 1);
    ctx.stroke();
  },
};

export const grid3Features = Object.keys(grid3Painters) as Grid3Feature[];

export type DrawTile = (
  ctx: B.ICanvasRenderingContext,
  width: number,
  height: number,
  features?: Partial<{
    grid3: Record<Grid3Feature, Signal<boolean>>,
  }>,
) => void;

export const drawTile3: DrawTile = (ctx, width, height, features) => {
  ctx.save();
  ctx.scale(height/2, height/2);
  ctx.translate(r3, 1);
  ctx.strokeStyle = "#000";

  for (const [name, painter] of Object.entries(grid3Painters)) {
    if (!features?.grid3?.[name].value) continue;
    for (const [x, y] of [
            [0,  2],
      [-r3,  1], [ r3,  1],
            [0,  0],
      [-r3, -1], [ r3, -1],
            [0, -2],
      ]
    ) {
      ctx.save();
      ctx.translate(x, y);
      for (let i = 0; i < 6; i++) {
        painter(ctx);
        ctx.rotate(TAU/6);
      }
      ctx.restore();
    }
  }
  ctx.restore();
};


function drawTile4(ctx: B.ICanvasRenderingContext, width: number, height: number) {
  ctx.strokeStyle = "#000";
  ctx.lineWidth = width / 20
  ctx.beginPath();
  ctx.moveTo(0    , 0     );
  ctx.lineTo(0    , height);
  ctx.lineTo(width, height);
  ctx.lineTo(width, 0     );
  ctx.lineTo(0    , 0     );
  ctx.stroke();
}

type GridDef = {
  tileRatio: number,
  drawTile: DrawTile,
  uvFunc(pos2D: B.Vector2): [number, number];
};

const uScaleN = 1 / r3;

export const grids: Record<GridType, GridDef> = {
  "none": {
    tileRatio: 1,
    drawTile() {},
    uvFunc: ({x, y}) => [x, y],
  },
  "triangular even": {
    tileRatio: r3,
    drawTile: drawTile3,
    uvFunc: ({x, y}) => [x * uScaleN, y],
  },
  "triangular odd": {
    tileRatio: r3,
    drawTile: drawTile3,
    uvFunc: ({x, y}) => [y * uScaleN, x],
  },
  "quad": {
    tileRatio: 1,
    drawTile: drawTile4,
    uvFunc: ({x, y}) => [x, y],
  },
  "quad diagonal": {
    tileRatio: 1,
    drawTile: drawTile4,
    uvFunc: ({x, y}) => [(x+y)/2, (x-y)/2],
  },
};

export type GridType =
| "none"
| "triangular even" | "triangular odd"
| "quad" | "quad diagonal"
;

export const gridTypes = Object.keys(grids) as GridType[];

export type GridSignals = {
  grid: Signal<GridType>,
  grid3: Record<Grid3Feature, Signal<boolean>>,
};

export function makeTexture(signals: GridSignals): B.DynamicTexture {
  const {tileRatio, drawTile} = grids[signals.grid.value];
  const height = 1 << 8;
  const width = height * tileRatio;
  const texture = new B.DynamicTexture("grid", {width, height});
  texture.wrapU = B.Constants.TEXTURE_WRAP_ADDRESSMODE;
  texture.wrapV = B.Constants.TEXTURE_WRAP_ADDRESSMODE;

  const ctx = texture.getContext();
  ctx.fillStyle = "#dd0";
  ctx.fillRect(0, 0, width, height);
  drawTile(ctx, width, height, {grid3: signals.grid3});

  texture.update();
  return texture;
}
