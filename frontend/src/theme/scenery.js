// Everything about the decorations on the board: what they look like, how many, and how far they keep from things.
// Drawn in components/SceneryNode.jsx, placed in utils/scenery.js.
export const OUTLINE = "#2B2D31";
export const STROKE = 3;

export const COLORS = {
  leafA: "#3F8A3A", // round tree
  leafB: "#2F7A45", // clustered tree
  bush: "#3A8F4C",
  tuft: "#7DBE55",
  wood: "#7A5230",
  rock: "#8A8F98",
};

// w/h = drawing size in px (before scale); weight = how often it is picked
export const KINDS = {
  treeA: { w: 56, h: 68, weight: 3 },
  treeB: { w: 60, h: 72, weight: 3 },
  bush: { w: 46, h: 32, weight: 3 },
  tuft: { w: 26, h: 22, weight: 2 },
  rock: { w: 34, h: 24, weight: 2 },
};

export const PLACEMENT = {
  maxTotal: 60, // hard cap
  cell: 150, // about one decoration per cell of empty space
  scale: [0.9, 1.15], // random size range
  outerPadding: 320, // how far past the outermost stations decorations may go
  density: { middle: 0.25, outside: 1 }, // chance a cell gets a decoration, near the centre vs. the outskirts
  clearance: {
    station: 40, // from any station
    track: 30, // from any track
    label: 14, // from any track label sign
    between: 8, // from other decorations
  },
};
