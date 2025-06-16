import Thurston from "./examples/Thurston.json5?raw";
import icosahedron from "./examples/icosahedron.json5?raw";
import wrinkledIcosahedron from "./examples/wrinkled-icosahedron.json5?raw";
import hexagonalPrism1 from './examples/hexagonal-prism.json5?raw';
import hexagonalPrism2 from './examples/hexagonal-prism-2.json5?raw';
import hexagonalPrism3 from './examples/hexagonal-prism-3.json5?raw';
import hexagonalAntiprism from './examples/hexagonal-antiprism.json5?raw';
import geSqBipyramid from './examples/gyroelongated-square-bipyramid.json5?raw';
import rhombicHexahedron from './examples/rhombic-hexahedron.json5?raw';
import nearMissJohnsonSolid from './examples/near-miss-Johnson-solid.json5?raw';
import nearMissJohnsonSolid2 from './examples/near-miss-Johnson-solid-2.json5?raw';
import nearMissJohnsonSolid3 from './examples/near-miss-Johnson-solid-3.json5?raw';
import cube from "./examples/cube.json5?raw";
import turtleCube from "./examples/turtle-cube.json5?raw";
import cairoCube from "./examples/cairo-cube.json5?raw"
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
  {name: "hexagonal antiprism", value: hexagonalAntiprism},
  {name: "Johnson solid 17", value: geSqBipyramid},
  {name: "rhombic hexahedron", value: rhombicHexahedron},
  {name: "near-miss Johnson solid", value: nearMissJohnsonSolid},
  {name: "near-miss Johnson solid #2", value: nearMissJohnsonSolid2},
  {name: "near-miss Johnson solid #3", value: nearMissJohnsonSolid3},
  {name: "cube", value: cube},
  {name: "cube with turtles", value: turtleCube},
  {name: "cube with cairo tiles", value: cairoCube},
  {name: "regular octahedron", value: octahedron},
  {name: "regular tetrahedron", value: tetrahedron},
  {name: "triangular dihedron", value: dihedron},
  {name: "empty", value: empty},
];
