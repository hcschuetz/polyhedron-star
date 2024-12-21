import * as V from 'valibot';

import { shortSteps, Task } from './taskspec';
import { grid3Backgrounds, grid3Features, grid4Backgrounds, grid4Features, gridTypes } from './tiling';


const sStep = V.union([
  V.object({x: V.number(), y: V.number()}),
  V.picklist(shortSteps),
]);

const sAngle = V.union([V.string(), V.number()]);

const sGap = V.object({
  steps: V.array(sStep),
  angleDeficit: sAngle,
});

const sEdgeSpec = V.union([
  V.string(),
  V.object({
    from: V.string(),
    through: V.optional(V.array(V.string())),
    to: V.string(),
    bend: sAngle,
  }),
]);

const sDisplaySettings = V.partial(V.object({
  vertices: V.boolean(),
  labels: V.boolean(),
  edges: V.boolean(),
  cuts: V.boolean(),
  faces: V.boolean(),
  breaks: V.boolean(),
  flower: V.boolean(),
  bending: V.number(),
  autobend: V.boolean(),
  grid: V.picklist(gridTypes),
  density: V.number(),
  grid3: V.partial(V.object(Object.fromEntries([
    ...grid3Features.map(f => [f, V.boolean()]),
    ["background", V.picklist(grid3Backgrounds)],
  ]))),
  grid4: V.partial(V.object(Object.fromEntries([
    ...grid4Features.map(f => [f, V.boolean()]),
    ["background", V.picklist(grid4Backgrounds)],
  ]))),
}));

const sTask = V.object({
  starGaps: V.record(V.string(), V.union([sGap, V.string()])),
  edges: V.array(sEdgeSpec),
  display: V.optional(sDisplaySettings),
});

export const validateTask = V.safeParser(sTask);
