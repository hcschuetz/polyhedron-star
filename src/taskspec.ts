import { Vector2 as V2 } from '@babylonjs/core';
import { fail } from './utils';


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

export type Task = {
  name: string,
  // Consistency:
  // - Gap names should be unique in a star.
  // - Angle deficits should add up to a value between 360 and 720 degrees
  //   (TAU to 2*TAU).
  // - The steps should return to the beginning.
  starGaps: Record<string, Gap>,
  edges: EdgeSpec[],
}



const r3 = Math.sqrt(3);
const r3Half = r3 / 2;
const TAU = 2 * Math.PI;

const angleUnits = {
  deg: TAU/360,
  rad: 1,
}

function shortStepToV2(s: ShortStep): V2 {
  switch (s) {
    case "e"  :
    case "3h" : return v2( 1     ,  0     );
    case "2h" : return v2( r3Half,  0.5   );
    case "1h" : return v2( 0.5   ,  r3Half);
    case "n"  :
    case "12h": return v2( 0     ,  1     );
    case "11h": return v2(-0.5   ,  r3Half);
    case "10h": return v2(-r3Half,  0.5   );
    case "w"  :
    case "9h" : return v2(-1     ,  0     );
    case "8h" : return v2(-r3Half, -0.5   );
    case "7h" : return v2(-0.5   , -r3Half);
    case "s"  :
    case "6h" : return v2( 0     , -1     );
    case "5h" : return v2( 0.5   , -r3Half);
    case "4h" : return v2( r3Half, -0.5   );
    default: fail(`unexpected step: "${s}"`);
  }
}

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
