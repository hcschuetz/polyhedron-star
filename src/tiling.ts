import { Signal } from '@preact/signals';
import * as B from '@babylonjs/core';

import { Obj } from './utils';
import { TAU } from './geom-utils';
import tile3a from './assets/tile3a.png';
import tile4a from './assets/tile4a.png';
import tile4b from './assets/tile4b.png';
import tile4c from './assets/tile4c.png';


// It would be cool to also have M. C. Escher-style creatures.

export type Grid3Background =
| "plain"
| "subTriangles"
| "tiles"
;

const grid3BackgroundPainters: Record<Grid3Background, (ctx: B.ICanvasRenderingContext) => void> = {
  plain(ctx) { /* do nothing */ },
  subTriangles(ctx) {
    ctx.fillStyle = "#cc0";
    ctx.beginPath();
    ctx.moveTo(  0   , 0  );
    // horizontal and vertical center lines:
    ctx.lineTo(  0   , 1/2);
    ctx.lineTo(  r3  , 1/2);
    ctx.lineTo(  r3  , 1  );
    ctx.lineTo(  r3/2, 1  );
    ctx.lineTo(  r3/2, 0  );
    ctx.lineTo(  0   , 0  );
    // triangles:
    ctx.lineTo(  r3/3, 1  );
    ctx.lineTo(2*r3/3, 0  );
    ctx.lineTo(  r3  , 1  );
    ctx.lineTo(  0   , 1  );
    ctx.lineTo(  r3/3, 0  );
    ctx.lineTo(2*r3/3, 1  );
    ctx.lineTo(  r3  , 0  );
    // diagonals:
    ctx.lineTo(  0   , 1  );
    ctx.lineTo(  0   , 0  );
    ctx.lineTo(  r3  , 1  );
    ctx.lineTo(  0   , 1  );
    ctx.closePath();
    // Why does BabylonJS use its own type instead of CanvasRenderingContext2D?
    (ctx as CanvasRenderingContext2D).fill('evenodd');
  },
  tiles(ctx) {
    ctx.drawImage(imgTile3a, 0, 0, r3, 1);
  },
};

export const grid3Backgrounds = Obj.keys(grid3BackgroundPainters);

export type Grid3Feature =
| "triangles"
| "diamonds"
| "hexagons1"
| "hexagons2"
| "arrows"
| "ball"
| "zigzag"
;

const r3 = Math.sqrt(3);

const imgTile3a = new Image(); imgTile3a.src = tile3a;
const imgTile4a = new Image(); imgTile4a.src = tile4a;
const imgTile4b = new Image(); imgTile4b.src = tile4b;
const imgTile4c = new Image(); imgTile4c.src = tile4c;

const grid3Painters: Record<Grid3Feature, (ctx: B.ICanvasRenderingContext) => void> = {
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

export const grid3Features = Obj.keys(grid3Painters);

export type DrawTile = (
  ctx: B.ICanvasRenderingContext,
  width: number,
  height: number,
  signals: GridSignals,
) => void;

export const drawTile3: DrawTile = (ctx, width, height, features) => {
  ctx.save();
  ctx.scale(height, height);
  grid3BackgroundPainters[features.grid3.background.value](ctx);
  ctx.restore();

  ctx.save();
  ctx.scale(height/2, height/2);
  ctx.translate(r3, 1);
  ctx.strokeStyle = "#000";

  for (const [name, painter] of Obj.entries(grid3Painters)) {
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


export type Grid4Background =
| "plain"
| "tiles A"
| "tiles B"
| "tiles C"
;

function drawImage4(ctx: B.ICanvasRenderingContext, img: HTMLImageElement) {
  const {naturalWidth: nw, naturalHeight: nh} = img;
  ctx.save();
  ctx.drawImage(img, 0, 0, nw, nh, 0, 0, 1/2, 1/2);
  ctx.translate(1, 0); ctx.scale(-1,1);
  ctx.drawImage(img, 0, 0, nw, nh, 0, 0, 1/2, 1/2);
  ctx.translate(0, 1); ctx.scale(1,-1);
  ctx.drawImage(img, 0, 0, nw, nh, 0, 0, 1/2, 1/2);
  ctx.translate(1, 0); ctx.scale(-1,1);
  ctx.drawImage(img, 0, 0, nw, nh, 0, 0, 1/2, 1/2);
  ctx.restore();
};

const grid4BackgroundPainters: Record<Grid4Background, (ctx: B.ICanvasRenderingContext) => void> = {
  plain(ctx) {
    // do nothing; the background has been painted by makeTexture(...); move this code here?
  },
  "tiles A"(ctx) { drawImage4(ctx, imgTile4a); },
  "tiles B"(ctx) { drawImage4(ctx, imgTile4b); },
  "tiles C"(ctx) { drawImage4(ctx, imgTile4c); },
};

export const grid4Backgrounds = Obj.keys(grid4BackgroundPainters);

export type Grid4Feature =
| "quads"
;

const grid4Painters: Record<Grid4Feature, (ctx: B.ICanvasRenderingContext) => void> = {
  quads: ctx => {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1 / 20
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 1);
    ctx.lineTo(1, 1);
    ctx.lineTo(1, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();  
  }
}

export const grid4Features = Obj.keys(grid4Painters);

const drawTile4: DrawTile = (ctx, width, height, signals) => {
  ctx.save();
  ctx.scale(width, height);
  grid4BackgroundPainters[signals.grid4.background.value](ctx);
  for (const [k, v] of Obj.entries(grid4Painters)) {
    if (signals.grid4[k].value) {
      v(ctx);
    }
  }
  ctx.restore();
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

export const gridTypes = Obj.keys(grids);

export type GridSignals = {
  grid: Signal<GridType>,
  grid3: Record<Grid3Feature, Signal<boolean>> & {background: Signal<Grid3Background>},
  grid4: Record<Grid4Feature, Signal<boolean>> & {background: Signal<Grid4Background>},
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
  drawTile(ctx, width, height, signals);

  texture.update();
  return texture;
}
