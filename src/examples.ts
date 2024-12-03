import { Task } from "./taskspec";

export const examples: {name: string, value: string}[] = [
  { name: "Thurston",
    value: `{
  star: {
    gaps: [
      {name: "a", angleDeficit: {num: 60, unit: "deg"}, steps: ["12h", "10h"]},
      {name: "b", angleDeficit: {num: 60, unit: "deg"}, steps: ["10h"]},
      {name: "c", angleDeficit: {num: 60, unit: "deg"}, steps: ["10h", "10h", "8h"]},
      {name: "d", angleDeficit: {num: 60, unit: "deg"}, steps: ["10h", "8h", "8h"]},
      {name: "e", angleDeficit: {num: 60, unit: "deg"}, steps: ["8h", "6h"]},
      {name: "f", angleDeficit: {num: 60, unit: "deg"}, steps: ["6h", "6h"]},
      {name: "g", angleDeficit: {num: 60, unit: "deg"}, steps: ["6h", "4h"]},
      {name: "h", angleDeficit: {num: 60, unit: "deg"}, steps: ["4h", "4h"]},
      {name: "i", angleDeficit: {num: 60, unit: "deg"}, steps: ["4h", "4h", "2h"]},
      {name: "j", angleDeficit: {num: 60, unit: "deg"}, steps: ["2h", "2h"]},
      {name: "k", angleDeficit: {num: 60, unit: "deg"}, steps: ["2h", "12h", "12h", "12h"]},
    ],
  },
  edges: [
    "a", "b", "e", "f", "g", "h", "j",
    {angle: {num: 30, unit: "deg"}, from: "a", to: "b"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "c"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "k"},
    {angle: {num: 30, unit: "deg"}, from: "b", to: "c"},
    {angle: {num: 30, unit: "deg"}, from: "c", to: "d"},
    {angle: {num: 30, unit: "deg"}, from: "c", to: "k"},
    {angle: {num: 30, unit: "deg"}, from: "d", to: "e"},
    {angle: {num: 30, unit: "deg"}, from: "d", to: "f"},
    {angle: {num: 30, unit: "deg"}, from: "d", to: "h"},
    {angle: {num: 30, unit: "deg"}, from: "d", to: "k"},
    {angle: {num: 30, unit: "deg"}, from: "e", to: "f"},
    {angle: {num: 30, unit: "deg"}, from: "f", to: "g"},
    {angle: {num: 30, unit: "deg"}, from: "f", to: "h"},
    {angle: {num: 30, unit: "deg"}, from: "g", to: "h"},
    {angle: {num: 30, unit: "deg"}, from: "h", to: "i"},
    {angle: {num: 30, unit: "deg"}, from: "h", to: "k"},
    {angle: {num: 30, unit: "deg"}, from: "i", to: "j"},
    {angle: {num: 30, unit: "deg"}, from: "i", to: "k"},
    {angle: {num: 30, unit: "deg"}, from: "b", to: "e", through: ["c", "d"]},
    {angle: {num: 30, unit: "deg"}, from: "c", to: "e", through: ["d"]},
    {angle: {num: 30, unit: "deg"}, from: "h", to: "j", through: ["i"]},
    {angle: {num: 30, unit: "deg"}, from: "i", to: "a", through: ["k"]},
    {angle: {num: 30, unit: "deg"}, from: "j", to: "a", through: ["k"]},
  ],
}`
  },
  { name: "icosahedron",
    value: `{
  star: {
    gaps: [
      {name: "a", angleDeficit: {num: 60, unit: "deg"}, steps: ["10h", "8h", "8h"]},
      {name: "b", angleDeficit: {num: 60, unit: "deg"}, steps: ["8h", "6h"]},
      {name: "c", angleDeficit: {num: 60, unit: "deg"}, steps: ["6h"]},
      {name: "d", angleDeficit: {num: 60, unit: "deg"}, steps: ["6h", "4h"]},
      {name: "e", angleDeficit: {num: 60, unit: "deg"}, steps: ["4h"]},
      {name: "f", angleDeficit: {num: 60, unit: "deg"}, steps: ["4h", "2h"]},
      {name: "g", angleDeficit: {num: 60, unit: "deg"}, steps: ["2h"]},
      {name: "h", angleDeficit: {num: 60, unit: "deg"}, steps: ["2h", "12h"]},
      {name: "i", angleDeficit: {num: 60, unit: "deg"}, steps: ["12h"]},
      {name: "j", angleDeficit: {num: 60, unit: "deg"}, steps: ["12h", "10h"]},
      {name: "k", angleDeficit: {num: 60, unit: "deg"}, steps: ["10h"]},
    ],
  },
  edges: [
    "c", "e", "g", "i", "k",
    {angle: {num: 30, unit: "deg"}, from: "a", to: "b"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "d"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "f"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "h"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "j"},
    {angle: {num: 30, unit: "deg"}, from: "b", to: "c"},
    {angle: {num: 30, unit: "deg"}, from: "b", to: "d"},
    {angle: {num: 30, unit: "deg"}, from: "c", to: "d"},
    {angle: {num: 30, unit: "deg"}, from: "d", to: "e"},
    {angle: {num: 30, unit: "deg"}, from: "d", to: "f"},
    {angle: {num: 30, unit: "deg"}, from: "e", to: "f"},
    {angle: {num: 30, unit: "deg"}, from: "f", to: "g"},
    {angle: {num: 30, unit: "deg"}, from: "f", to: "h"},
    {angle: {num: 30, unit: "deg"}, from: "g", to: "h"},
    {angle: {num: 30, unit: "deg"}, from: "h", to: "i"},
    {angle: {num: 30, unit: "deg"}, from: "h", to: "j"},
    {angle: {num: 30, unit: "deg"}, from: "i", to: "j"},
    {angle: {num: 30, unit: "deg"}, from: "j", to: "k"},
    {angle: {num: 30, unit: "deg"}, from: "j", to: "b", through: ["a"]},
    {angle: {num: 30, unit: "deg"}, from: "k", to: "b", through: ["a"]},
    {angle: {num: 30, unit: "deg"}, from: "k", to: "c", through: ["a", "b"]},
    {angle: {num: 30, unit: "deg"}, from: "c", to: "e", through: ["d"]},
    {angle: {num: 30, unit: "deg"}, from: "e", to: "g", through: ["f"]},
    {angle: {num: 30, unit: "deg"}, from: "g", to: "i", through: ["h"]},
    {angle: {num: 30, unit: "deg"}, from: "i", to: "k", through: ["j"]},
  ],
}`
  },
  { name: "cube",
    value: `{
  star: {
    gaps: [
      {name: "a", angleDeficit: {num: 90, unit: "deg"}, steps: ["w", "w"]},
      {name: "b", angleDeficit: {num: 90, unit: "deg"}, steps: ["w", "s"]},
      {name: "c", angleDeficit: {num: 90, unit: "deg"}, steps: ["s", "s"]},
      {name: "d", angleDeficit: {num: 90, unit: "deg"}, steps: ["s", "e"]},
      {name: "e", angleDeficit: {num: 90, unit: "deg"}, steps: ["e", "e"]},
      {name: "f", angleDeficit: {num: 90, unit: "deg"}, steps: ["e", "n"]},
      {name: "g", angleDeficit: {num: 90, unit: "deg"}, steps: ["w", "n", "n", "n"]},
    ],
  },
  edges: [
    "b", "d", "f",
    {angle: {num: 30, unit: "deg"}, from: "a", to: "b"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "c"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "g"},
    {angle: {num: 30, unit: "deg"}, from: "b", to: "c"},
    {angle: {num: 30, unit: "deg"}, from: "c", to: "d"},
    {angle: {num: 30, unit: "deg"}, from: "c", to: "e"},
    {angle: {num: 30, unit: "deg"}, from: "c", to: "g"},
    {angle: {num: 30, unit: "deg"}, from: "d", to: "e"},
    {angle: {num: 30, unit: "deg"}, from: "e", to: "g"},
    {angle: {num: 30, unit: "deg"}, from: "e", to: "f"},
    {angle: {num: 30, unit: "deg"}, from: "e", to: "a", through: ["g"]},
    {angle: {num: 30, unit: "deg"}, from: "b", to: "d", through: ["c"]},
    {angle: {num: 30, unit: "deg"}, from: "d", to: "f", through: ["e"]},
    {angle: {num: 30, unit: "deg"}, from: "f", to: "a", through: ["g"]},
    {angle: {num: 30, unit: "deg"}, from: "f", to: "b", through: ["g", "a"]},
  ],
}`
  },
  { name: "octahedron",
    value: `{
  star: {
    gaps: [
      {name: "a", angleDeficit: {num: 120, unit: "deg"}, steps: ["8h", "8h", "8h"]},
      {name: "b", angleDeficit: {num: 120, unit: "deg"}, steps: ["6h", "4h"]},
      {name: "c", angleDeficit: {num: 120, unit: "deg"}, steps: ["4h", "2h"]},
      {name: "d", angleDeficit: {num: 120, unit: "deg"}, steps: ["2h", "12h"]},
      {name: "e", angleDeficit: {num: 120, unit: "deg"}, steps: ["12h", "10h"]},
    ],
  },
  edges: [
    "b", "c", "d", "e",
    {angle: {num: 30, unit: "deg"}, from: "a", to: "b"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "c"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "d"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "e"},
    {angle: {num: 30, unit: "deg"}, from: "b", to: "c"},
    {angle: {num: 30, unit: "deg"}, from: "c", to: "d"},
    {angle: {num: 30, unit: "deg"}, from: "d", to: "e"},
    {angle: {num: 30, unit: "deg"}, from: "e", to: "b", through: ["a"]},
  ],
}`
  },
  { name: "tetrahedron",
    value: `{
  star: {
    gaps: [
      {name: "a", angleDeficit: {num: 180, unit: "deg"}, steps: ["8h", "8h"]},
      {name: "b", angleDeficit: {num: 180, unit: "deg"}, steps: ["4h", "4h"]},
      {name: "c", angleDeficit: {num: 180, unit: "deg"}, steps: ["12h", "12h"]},
    ],
  },
  edges: [
    "a", "b", "c",
    {angle: {num: 30, unit: "deg"}, from: "a", to: "b"},
    {angle: {num: 30, unit: "deg"}, from: "a", to: "c"},
    {angle: {num: 30, unit: "deg"}, from: "b", to: "c"},
  ],
}`
  },
  { name: "two triangles",
    value: `{
  star: {
    gaps: [
      {name: "a", angleDeficit: {num: 240, unit: "deg"}, steps: ["s", "s"]},
      {name: "b", angleDeficit: {num: 240, unit: "deg"}, steps: ["n", "n"]},
    ],
  },
  edges: [
    "a", "b",
    {angle: {num: 30, unit: "deg"}, from: "a", to: "b"},
  ],
}`
  },
  { name: "empty", value: `{
  star: {
    gaps: [
      {name: "a", angleDeficit: {num: 360, unit: "deg"}, steps: []},
    ]
  },
  edges: [
  ],
}`}
];
