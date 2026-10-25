import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import RepoNode from "@/components/RepoNode";
import RailEdge from "@/components/RailEdge";
import SceneryNode from "@/components/SceneryNode";
import GrassBackground from "@/components/GrassBackground";
import homeDiagram from "@/mock/homeDiagram.json";
import { layoutGraph, NODE_WIDTH, NODE_HEIGHT } from "@/utils/layout";
import { routeDiagram } from "@/utils/rails";
import { placeScenery } from "@/utils/scenery";

const nodeTypes = { repoNode: RepoNode, scenery: SceneryNode };
const edgeTypes = { rail: RailEdge };

// Tweak here
const ZOOM = { min: 0.5, max: 1.1 }; // same limits as the real board's default fit
const PAD = 24; // screen px kept free round the diagram when fitting
const CARD_MARGIN = 60; // screen px of clear space round the ticket card
const MIN_RANK_GAP = 230; // flow px of track (and label) between neighbouring columns
const NARROW = 720; // below this the card fills the screen: no gap is opened for it

const overlaps = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

// Dagre's left-to-right layout, computed once (the data never changes)
const baseNodes = layoutGraph(
  homeDiagram.nodes.map((n) => ({ id: n.id, type: "repoNode", position: { x: 0, y: 0 }, data: n })),
  homeDiagram.edges,
).nodes;

// Everything the screen needs: positioned stations, routed tracks with labels, scenery, and the viewport.
// `W`/`H` = screen size, `card` = the ticket card's rect on screen (px).
// The viewport is fixed at (0, 0), so flow coords are just screen px divided by the zoom.
function compose(W, H, card) {
  const narrow = W < NARROW;
  const zoneW = narrow ? 0 : card.x2 - card.x1 + 2 * CARD_MARGIN;

  // Columns (ranks) of the dagre layout, left to right, each with its stations top to bottom.
  // Left half goes left of the card, the rest right of it (on narrow screens everything is one group).
  const columns = [...new Set(baseNodes.map((n) => Math.round(n.position.x)))]
    .sort((p, q) => p - q)
    .map((x) => baseNodes.filter((n) => Math.round(n.position.x) === x).sort((p, q) => p.position.y - q.position.y));
  const groups = narrow ? [columns] : [columns.slice(0, Math.ceil(columns.length / 2)), columns.slice(Math.ceil(columns.length / 2))];

  // 1. Biggest zoom at which every group has room for its columns with MIN_RANK_GAP of track between them
  let zoom = ZOOM.min;
  for (let z = ZOOM.max; z >= ZOOM.min - 1e-9; z -= 0.05) {
    const room = ((W - zoneW) / z) / groups.length - 2 * (PAD / z);
    if (groups.every((g) => room - g.length * NODE_WIDTH >= (g.length - 1) * MIN_RANK_GAP)) {
      zoom = z;
      break;
    }
  }
  const ox = 0;
  const oy = 0;
  const view = { x1: 0, y1: 0, x2: W / zoom, y2: H / zoom };
  const m = PAD / zoom;
  const toFlow = (r) => ({ x1: r.x1 / zoom, y1: r.y1 / zoom, x2: r.x2 / zoom, y2: r.y2 / zoom });
  const zone = toFlow({ x1: card.x1 - CARD_MARGIN, y1: card.y1 - CARD_MARGIN, x2: card.x2 + CARD_MARGIN, y2: card.y2 + CARD_MARGIN });

  // 2. Spread the columns evenly across their half of the screen, and the stations in each column evenly top to bottom
  const stations = [];
  groups.forEach((group, gi) => {
    const x1 = narrow ? m : gi === 0 ? m : zone.x2;
    const x2 = narrow ? view.x2 - m : gi === 0 ? zone.x1 : view.x2 - m;
    group.forEach((col, ci) => {
      const x = group.length === 1 ? (x1 + x2 - NODE_WIDTH) / 2 : x1 + (ci * (x2 - x1 - NODE_WIDTH)) / (group.length - 1);
      const band = (view.y2 - view.y1 - 2 * m) / col.length;
      col.forEach((n, ri) => {
        const y = view.y1 + m + band * (ri + 0.5) - NODE_HEIGHT / 2;
        stations.push({ ...n, position: { x, y } });
      });
    });
  });

  // 3. Tracks. A label that would land under the card is left off (a second pass re-routes without it).
  let edges = homeDiagram.edges;
  let routed = routeDiagram(stations, edges);
  const hidden = routed.edges.filter((e) => {
    const p = e.data?.labelPlacement;
    return p && overlaps({ x1: p.cx - p.w / 2, y1: p.cy - p.h / 2, x2: p.cx + p.w / 2, y2: p.cy + p.h / 2 }, zone);
  });
  if (hidden.length) {
    const gone = new Set(hidden.map((e) => e.id));
    edges = edges.map((e) => (gone.has(e.id) ? { ...e, label: undefined } : e));
    routed = routeDiagram(stations, edges);
  }

  // 4. Scenery over the open grass. Four fake stations just outside the screen corners make it cover the whole
  //    screen; anything that lands on the card or off screen is dropped.
  const corners = [[view.x1, view.y1, -1, -1], [view.x2, view.y1, 0, -1], [view.x1, view.y2, -1, 0], [view.x2, view.y2, 0, 0]].map(([cx, cy, dx, dy], i) => ({
    id: `corner-${i}`, position: { x: cx + dx * NODE_WIDTH, y: cy + dy * NODE_HEIGHT },
  }));
  const locked = { draggable: false, selectable: false, connectable: false, focusable: false, deletable: false };
  const scenery = placeScenery("home", [...routed.nodes, ...corners], routed.tracks, routed.labelRects, { outerPadding: 40, maxTotal: 220 })
    .filter((d) => {
      const r = { x1: d.x, y1: d.y, x2: d.x + 60 * d.scale, y2: d.y + 72 * d.scale };
      return !overlaps(r, zone) && r.x1 > view.x1 && r.y1 > view.y1 && r.x2 < view.x2 && r.y2 < view.y2;
    })
    .map((d) => ({
      id: d.id,
      type: "scenery",
      position: { x: d.x, y: d.y },
      data: { kind: d.kind, scale: d.scale, flip: d.flip },
      zIndex: -1,
      ...locked,
    }));

  return {
    nodes: [...scenery, ...routed.nodes.map((n) => ({ ...n, ...locked }))],
    edges: routed.edges.map((e) => ({ ...e, selectable: false, focusable: false, deletable: false })),
    viewport: { x: ox, y: oy, zoom },
  };
}

// Keeps the locked viewport at the computed fit
function SceneViewport({ viewport }) {
  const { setViewport } = useReactFlow();
  useEffect(() => {
    setViewport(viewport);
  }, [viewport, setViewport]);
  return null;
}

// Backdrop for the logged-out home page: a sample architecture drawn with the real board's stations, tracks and
// scenery, completely static, with the card's area kept clear. `avoidRef` = the element holding the card.
// Own provider, own data: fully separate from the repo board.
export default function HomeBackground({ avoidRef }) {
  const rootRef = useRef(null);
  const [size, setSize] = useState(null); // { w, h, card } in screen px

  useLayoutEffect(() => {
    const measure = () => {
      const root = rootRef.current;
      if (!root) return;
      const box = root.getBoundingClientRect();
      const c = avoidRef?.current?.getBoundingClientRect();
      setSize({
        w: box.width,
        h: box.height,
        card: c
          ? { x1: c.left - box.left, y1: c.top - box.top, x2: c.right - box.left, y2: c.bottom - box.top }
          : { x1: box.width / 2 - 224, y1: box.height / 2 - 300, x2: box.width / 2 + 224, y2: box.height / 2 + 300 },
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rootRef.current);
    if (avoidRef?.current) observer.observe(avoidRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [avoidRef]);

  const scene = useMemo(() => (size ? compose(size.w, size.h, size.card) : null), [size]);

  return (
    <ReactFlowProvider>
      <div ref={rootRef} className="home-bg pointer-events-none absolute inset-0" aria-hidden>
        <ReactFlow
          nodes={scene?.nodes ?? []}
          edges={scene?.edges ?? []}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultViewport={scene?.viewport ?? { x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={2}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          selectionOnDrag={false}
          disableKeyboardA11y
          proOptions={{ hideAttribution: true }}
        >
          <GrassBackground />
          {scene && <SceneViewport viewport={scene.viewport} />}
        </ReactFlow>
        {/* Light dimming so the card stands out */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(31,45,38,0.32),rgba(31,45,38,0.1))]" />
      </div>
    </ReactFlowProvider>
  );
}
