import SceneryNode from "@/components/SceneryNode";

// Greenery and street furniture around the Inspection page (SVG, aria-hidden)
const IRON = "#2B2D31";
const s = { stroke: IRON, strokeWidth: 3, strokeLinejoin: "round" };
const thin = { stroke: IRON, strokeWidth: 2, strokeLinejoin: "round" };

// Extra street furniture, same flat 3px-outline style as SceneryNode
function LampPost() {
  return (
    <svg width="34" height="96" viewBox="0 0 34 96" overflow="visible">
      <rect x="14" y="26" width="6" height="68" fill="#4A4D54" {...s} />
      <rect x="8" y="88" width="18" height="8" rx="2" fill="#4A4D54" {...s} />
      <path d="M6 26 L10 6 H24 L28 26 Z" fill="#F0DDA8" {...s} />
      <rect x="9" y="2" width="16" height="6" rx="2" fill="#4A4D54" {...s} />
    </svg>
  );
}
function Bench() {
  return (
    <svg width="64" height="40" viewBox="0 0 64 40" overflow="visible">
      <rect x="4" y="10" width="56" height="8" rx="2" fill="#9A6B3F" {...s} />
      <rect x="4" y="22" width="56" height="8" rx="2" fill="#9A6B3F" {...s} />
      <rect x="8" y="30" width="6" height="9" fill="#4A4D54" {...s} />
      <rect x="50" y="30" width="6" height="9" fill="#4A4D54" {...s} />
    </svg>
  );
}
function Fence() {
  return (
    <svg width="96" height="40" viewBox="0 0 96 40" overflow="visible">
      <rect x="2" y="12" width="92" height="5" fill="#C9A27A" {...thin} />
      <rect x="2" y="24" width="92" height="5" fill="#C9A27A" {...thin} />
      {[6, 28, 50, 72].map((x) => <rect key={x} x={x} y="4" width="9" height="34" fill="#E0BE92" {...s} />)}
    </svg>
  );
}
const EXTRA = { lamp: LampPost, bench: Bench, fence: Fence };

// Trees, bushes, rocks and street furniture filling the grass margins around the town square (wide screens only)
const SPOTS = [
  ["treeA", "left-4 top-[40px]", 1.15], ["bush", "left-8 top-[150px]", 1.1], ["lamp", "left-6 top-[250px]"],
  ["treeB", "left-3 top-[360px]", 1.15, true], ["rock", "left-8 top-[500px]", 1.15], ["bench", "left-4 top-[570px]"],
  ["bush", "left-3 top-[690px]", 1.15, true], ["treeA", "left-6 top-[780px]", 1.15], ["fence", "left-3 top-[900px]"],
  ["tuft", "left-8 top-[990px]", 1.15], ["treeB", "left-3 top-[1060px]", 1.15],
  ["treeB", "right-4 top-[60px]", 1.15, true], ["rock", "right-8 top-[170px]", 1.1], ["treeA", "right-3 top-[250px]", 1.15],
  ["bush", "right-6 top-[400px]", 1.15, true], ["lamp", "right-8 top-[470px]"], ["fence", "right-3 top-[620px]"],
  ["treeB", "right-5 top-[700px]", 1.1], ["bench", "right-4 top-[850px]"], ["bush", "right-8 top-[950px]", 1.1],
  ["treeA", "right-3 top-[1020px]", 1.15, true], ["tuft", "right-6 top-[1130px]", 1.15],
];
export function Scenery() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden overflow-hidden xl:block" aria-hidden="true">
      {SPOTS.map(([kind, pos, scale = 1, flip = false], i) => {
        const Extra = EXTRA[kind];
        return (
          <div key={i} className={`absolute ${pos}`}>
            {Extra ? <Extra /> : <SceneryNode data={{ kind, scale, flip }} />}
          </div>
        );
      })}
    </div>
  );
}
