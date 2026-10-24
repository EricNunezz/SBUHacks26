import { useMemo } from "react";
import { layoutGraph, NODE_WIDTH, NODE_HEIGHT } from "@/utils/layout";
import { getCategoryTheme } from "@/theme/categories";

// Never zoom a tiny diagram past this, so 2 stations don't become giant
const MIN_W = NODE_WIDTH * 2.6;
const MIN_H = NODE_HEIGHT * 1.5;

// A thumbnail of a diagram, drawn as plain SVG (no React Flow). It runs the same dagre layout the board uses on the
// preview's nodes and edges, then lets the SVG viewBox scale everything to fit the panel.
//  - stations: a small roof + building + platform in the node's line colour
//  - tracks: thin dark elbow lines from a station's right edge to the next one's left edge
// Strokes use vector-effect="non-scaling-stroke", so they stay a crisp 1.5px however far the map is scaled down.
export default function MiniMap({ preview }) {
  const model = useMemo(() => {
    const ids = new Set(preview.nodes.map((n) => n.id));
    const edges = preview.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    const { nodes } = layoutGraph(preview.nodes.map((n) => ({ id: n.id, position: { x: 0, y: 0 } })), edges);
    const at = new Map(nodes.map((n) => [n.id, n.position]));

    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    nodes.forEach(({ position: p }) => {
      x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
      x2 = Math.max(x2, p.x + NODE_WIDTH); y2 = Math.max(y2, p.y + NODE_HEIGHT);
    });
    const w = Math.max(x2 - x1 + NODE_WIDTH * 0.4, MIN_W);
    const h = Math.max(y2 - y1 + NODE_HEIGHT * 0.4, MIN_H);
    const viewBox = `${(x1 + x2) / 2 - w / 2} ${(y1 + y2) / 2 - h / 2} ${w} ${h}`;

    const tracks = edges.map((e, i) => {
      const a = at.get(e.source);
      const b = at.get(e.target);
      const sx = a.x + NODE_WIDTH;
      const sy = a.y + NODE_HEIGHT * 0.6;
      const tx = b.x;
      const ty = b.y + NODE_HEIGHT * 0.6;
      const mid = (sx + tx) / 2;
      return { key: `${e.source}-${e.target}-${i}`, d: `M${sx} ${sy} H${mid} V${ty} H${tx}` };
    });
    const stations = preview.nodes.map((n) => ({ id: n.id, ...at.get(n.id), color: getCategoryTheme(n.category).color }));
    return { viewBox, tracks, stations };
  }, [preview]);

  const stroke = { stroke: "#2B2D31", strokeWidth: 1.5, vectorEffect: "non-scaling-stroke", strokeLinejoin: "round" };

  return (
    <svg viewBox={model.viewBox} preserveAspectRatio="xMidYMid meet" className="block h-full w-full" role="img" aria-label="Map preview">
      {model.tracks.map((t) => (
        <path key={t.key} d={t.d} fill="none" {...stroke} />
      ))}
      {model.stations.map((s) => (
        <g key={s.id} transform={`translate(${s.x} ${s.y})`}>
          <polygon points={`8,54 ${NODE_WIDTH / 2},8 ${NODE_WIDTH - 8},54`} fill={s.color} {...stroke} />
          <rect x="22" y="54" width={NODE_WIDTH - 44} height="78" fill="#FBF9F5" {...stroke} />
          <rect x="6" y="132" width={NODE_WIDTH - 12} height="26" rx="4" fill="#8A8F98" {...stroke} />
        </g>
      ))}
    </svg>
  );
}
