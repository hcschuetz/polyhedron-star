import { Vector2 as V2 } from '@babylonjs/core';
import { fail } from './utils';


const v2 = (x?: number , y?: number) => new V2(x, y);

// Consistency:
// - Gap names should be unique in a star.
// - Angle deficits should add up to a value between 360 and 720 degrees
//   (TAU to 2*TAU).
// - The steps should return to the beginning.
export type StarSpec = {
  gaps: Gap[];
};
export type Gap = {
  name: string,
  steps: Step[],
  angleDeficit: Angle,
};
export type Angle = {
  num: number,
  unit: "deg" | "rad",
};
export type Step =
| {
  amount: number,
  direction: ShortDirection | Angle,
}
| ShortDirection;

export type ShortDirection =
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
    angle: Angle,
  }
;

export type Task = {
  name: string,
  info?: string,
  star: StarSpec,
  edges: EdgeSpec[],
}



const r3 = Math.sqrt(3);
const r3Half = r3 / 2;
const TAU = 2 * Math.PI;

const angleUnits = {
  deg: TAU/360,
  rad: 1,
}

function directionToV2(dir: ShortDirection): V2 {
  switch (dir) {
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
    default: fail(`unexpected direction: "${dir}"`);
  }
}

export const angleToRad = ({num, unit}: Angle): number =>
  num * (angleUnits[unit] ?? fail(`unexpected angle unit "${unit}"`));

export function angleToV2(angleObj: Angle): V2 {
  const angle = angleToRad(angleObj);
  return v2(Math.cos(angle), Math.sin(angle));
}

export function stepToV2(step: Step): V2 {
  if (typeof step === "string") {
    return directionToV2(step);
  } else {
    const {amount, direction} = step;
    const v =
      typeof direction === "string"
      ? directionToV2(direction)
      : angleToV2(direction);
    return v.scaleInPlace(amount);
  }
}
