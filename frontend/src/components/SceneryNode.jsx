import { COLORS, KINDS, OUTLINE, STROKE } from "@/theme/scenery";

// Flat cartoon decorations: SVG only, 3px outline, no shading.
// Clustered shapes (crowns, bushes) are drawn twice: a fat outline pass, then a fill-only pass on top,
// so only the outer edge of the cluster keeps its outline.
function Cluster({ circles, fill }) {
  return (
    <>
      {circles.map(([cx, cy, r], i) => (
        <circle key={`o${i}`} cx={cx} cy={cy} r={r} fill={fill} stroke={OUTLINE} strokeWidth={STROKE * 2} />
      ))}
      {circles.map(([cx, cy, r], i) => (
        <circle key={`f${i}`} cx={cx} cy={cy} r={r} fill={fill} />
      ))}
    </>
  );
}

const outline = { stroke: OUTLINE, strokeWidth: STROKE, strokeLinejoin: "round" };

const DRAW = {
  treeA: () => (
    <>
      <rect x="22" y="44" width="12" height="21" rx="2" fill={COLORS.wood} {...outline} />
      <circle cx="28" cy="28" r="24" fill={COLORS.leafA} {...outline} />
    </>
  ),
  treeB: () => (
    <>
      <rect x="25" y="48" width="10" height="20" rx="2" fill={COLORS.wood} {...outline} />
      <Cluster fill={COLORS.leafB} circles={[[20, 36, 15], [40, 36, 15], [30, 21, 16]]} />
    </>
  ),
  bush: () => <Cluster fill={COLORS.bush} circles={[[13, 21, 9], [24, 16, 11], [34, 21, 9]]} />,
  tuft: () => (
    <path d="M3 19 L7 5 L12 15 L16 2 L20 15 L24 7 L23 19 Z" fill={COLORS.tuft} {...outline} />
  ),
  rock: () => <path d="M3 21 L7 9 L17 3 L28 8 L31 21 Z" fill={COLORS.rock} {...outline} />,
};

// A React Flow node of type "scenery": not draggable, selectable or clickable (see DiagramBoard)
export default function SceneryNode({ data }) {
  const { w, h } = KINDS[data.kind];
  const Draw = DRAW[data.kind];
  return (
    <svg
      width={w * data.scale}
      height={h * data.scale}
      viewBox={`0 0 ${w} ${h}`}
      overflow="visible"
      aria-hidden
      style={{ display: "block", pointerEvents: "none", transform: data.flip ? "scaleX(-1)" : undefined }}
    >
      <Draw />
    </svg>
  );
}
