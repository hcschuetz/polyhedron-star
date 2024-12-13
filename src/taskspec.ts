import { Vector2 as V2 } from '@babylonjs/core';
import { fail } from './utils';
import { Grid3Feature, GridType } from './tiling';


const v2 = (x?: number , y?: number) => new V2(x, y);

export type Gap = {
  steps: Step[],
  angleDeficit: Angle,
};
/** `.5`, `".5"` (in radians), `"60deg", `"60°"` (in degrees) */
export type Angle = string | number;

export type Step =
| {x: number, y: number}
| ShortStep;
export type ShortStep =
| "e" | "n" | "w" | "s"
| "3h" | "2h" | "1h" | "12h" | "11h" | "10h" | "9h" | "8h" | "7h" | "6h" | "5h" | "4h"
;

// All the strings here reference gap names
export type EdgeSpec =
// An edge along a "contracted" gap:
| string
// An edge from the inner vertex of an gap to the inner vertex of
// some other gap, crossing 0 or more gaps:
| {
    from: string,
    through?: string[],
    to: string,
    // Bending angle, that is, 180 deg - dihedral angle;
    // can be negative to indicate bending to the other side;
    // (just a provisional value)
    bend: Angle,
  }
;

export type DisplaySettings = Partial<{
  vertices: boolean,
  labels: boolean,
  edges: boolean,
  cuts: boolean,
  faces: boolean,
  breaks: boolean,
  flower: boolean,
  bending: number,
  autobend: boolean,
  grid: GridType,
  density: number,
  grid3: Partial<Record<Grid3Feature, boolean>>,
}>;

export type Task = {
  name: string,
  // Consistency:
  // - Gap names should be unique in a star.
  // - Angle deficits should add up to a value between 360 and 720 degrees
  //   (TAU to 2*TAU).
  // - The steps should return to the beginning.
  starGaps: Record<string, Gap | string>,
  edges: EdgeSpec[],
  display?: DisplaySettings,
}



const r3 = Math.sqrt(3);
const r3Half = r3 / 2;
const TAU = 2 * Math.PI;

const angleUnits = {
  deg: TAU/360,
  rad: 1,
}

export const stepOffsets: Record<ShortStep, V2> = {
  "3h" : v2( 1     ,  0     ),
  "2h" : v2( r3Half,  0.5   ),
  "1h" : v2( 0.5   ,  r3Half),
  "12h": v2( 0     ,  1     ),
  "11h": v2(-0.5   ,  r3Half),
  "10h": v2(-r3Half,  0.5   ),
  "9h" : v2(-1     ,  0     ),
  "8h" : v2(-r3Half, -0.5   ),
  "7h" : v2(-0.5   , -r3Half),
  "6h" : v2( 0     , -1     ),
  "5h" : v2( 0.5   , -r3Half),
  "4h" : v2( r3Half, -0.5   ),

  "e"  : v2( 1     ,  0     ),
  "n"  : v2( 0     ,  1     ),
  "w"  : v2(-1     ,  0     ),
  "s"  : v2( 0     , -1     ),
}

const shortStepToV2 = (s: ShortStep): V2 =>
  stepOffsets[s] ?? fail(`unexpected step: "${s}"`);

export function angleToRad(angle: Angle): number {
  switch (typeof angle) {
    case "number": return angle;
    case "string": {
      const match = /(deg|°)$/.exec(angle);
      if (match) {
        return Number.parseFloat(angle.slice(0, match.index)) * (TAU/360);
      }
      return Number.parseFloat(angle);
    }
    default: fail(`unexpected type for angle: ${typeof angle}`);
  }
}

export function stepToV2(step: Step): V2 {
  if (typeof step === "string") {
    return shortStepToV2(step);
  } else {
    const {x, y} = step;
    return v2(x, y);
  }
}
