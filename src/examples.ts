import Thurston from "./examples/Thurston.json5?raw";
import icosahedron from "./examples/icosahedron.json5?raw";
import wrinkledIcosahedron from "./examples/wrinkled-icosahedron.json5?raw";
import hexagonalPrism1 from './examples/hexagonal-prism.json5?raw';
import hexagonalPrism2 from './examples/hexagonal-prism-2.json5?raw';
import hexagonalPrism3 from './examples/hexagonal-prism-3.json5?raw';
import cube from "./examples/cube.json5?raw";
import octahedron from "./examples/octahedron.json5?raw";
import tetrahedron from "./examples/tetrahedron.json5?raw";
import dihedron from "./examples/dihedron.json5?raw";
import empty from "./examples/empty.json5?raw";

export const examples: {name: string, value: string}[] = [
  {name: "Thurston", value: Thurston},
  {name: "regular icosahedron", value: icosahedron},
  {name: "wrinkled icosahedron", value: wrinkledIcosahedron},
  {name: "hexagonal prism #1", value: hexagonalPrism1},
  {name: "hexagonal prism #2", value: hexagonalPrism2},
  {name: "hexagonal prism #3", value: hexagonalPrism3},
  {name: "cube", value: cube},
  {name: "regular octahedron", value: octahedron},
  {name: "regular tetrahedron", value: tetrahedron},
  {name: "triangular dihedron", value: dihedron},
  {name: "empty", value: empty}
];
