import { getSmoothStepPath, Position } from "@xyflow/react";
import { NODE_WIDTH, NODE_HEIGHT, shortLabel } from "@/utils/layout";

// Station geometry shared with RepoNode / index.css (".station-*"). Keep in sync with the roof SVG in RepoNode.
export const HANDLE_SIZE = 12;
// Tracks run left to right: they leave through the right wall of a station and arrive at its left wall.
export const LEFT_PORT_X = 10; // centre of the facade's left wall
export const RIGHT_PORT_X = 250; // centre of the facade's right wall
const PORT_TOP = 30; // ports are spread between here and PORT_BOTTOM (below the roof, above the platform)
const PORT_BOTTOM = 148;

// Track layout tuning
const BORDER_RADIUS = 20;
const LANE = 36; // min px between the centre lines of parallel tracks (a track is ~15px wide)
const LABEL_GAP = 29; // track centre line -> near edge of its sign
const LABEL_H = 36;
const CHAR_W = 11; // 18px bold monospace

// y of the i-th of n ports down a station's left (incoming) or right (outgoing) wall
export const portY = (i, n) => PORT_TOP + ((i + 1) / (n + 1)) * (PORT_BOTTOM - PORT_TOP);

// Straight pieces of an SVG smooth-step path (the L commands; corner arcs are Q commands and are skipped)
function straightSegments(path) {
  const segs = [];
  let cur = null;
  for (const cmd of path.match(/[MLQ][^MLQ]*/g) ?? []) {
    const n = cmd.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
    const end = [n[n.length - 2], n[n.length - 1]];
    if (cmd[0] === "L" && cur && Math.hypot(end[0] - cur[0], end[1] - cur[1]) > 1) {
      segs.push({ x1: cur[0], y1: cur[1], x2: end[0], y2: end[1] });
    }
    cur = end;
  }
  return segs;
}

const overlaps = (a, b, pad = 0) =>
  a.x1 < b.x2 + pad && a.x2 > b.x1 - pad && a.y1 < b.y2 + pad && a.y2 > b.y1 - pad;

// Position of `rank` among `count` lanes, centred on 0 (in px)
const lane = (rank, count) => (rank - (count - 1) / 2) * LANE;

/**
 * Gives every edge its own port on each station, its own lane in the row gap, and (if labelled) a sign position.
 * Also returns `tracks` and `labelRects` (obstacles for the scenery). Returns nodes with `data.ports` and edges with sourceHandle/targetHandle and `data.{stepPosition, offset, labelPlacement}`.
 */
export function routeDiagram(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cy = (id) => byId.get(id).position.y + NODE_HEIGHT / 2;
  const list = edges.filter((e) => byId.has(e.source) && byId.has(e.target));

  // 1. Ports: outgoing edges ordered by target y, incoming by source y, so tracks fan out without crossing
  const outs = new Map();
  const ins = new Map();
  const push = (map, key, e) => map.set(key, [...(map.get(key) ?? []), e]);
  list.forEach((e) => {
    push(outs, e.source, e);
    push(ins, e.target, e);
  });
  const sorter = (other) => (a, b) => cy(a[other]) - cy(b[other]) || String(a.id).localeCompare(String(b.id));
  const info = new Map(list.map((e) => [e, {}]));
  outs.forEach((group) => group.sort(sorter("target")).forEach((e, i) => (info.get(e).out = i)));
  ins.forEach((group) => group.sort(sorter("source")).forEach((e, i) => (info.get(e).in = i)));

  // 2. Lanes: within one side of a station, the farther the other end, the earlier (source) / later (target) the
  //    track turns. That keeps a track's vertical run from cutting across its neighbours' horizontal runs.
  const laneFor = (group, getDy, sign) => {
    const sides = { left: [], right: [], straight: [] }; // "left" = above, "right" = below
    group.forEach((e) => {
      const dy = getDy(e);
      sides[Math.abs(dy) < 4 ? "straight" : dy < 0 ? "left" : "right"].push(e);
    });
    Object.values(sides).forEach((side) => {
      side.sort((a, b) => Math.abs(getDy(b)) - Math.abs(getDy(a))); // farthest first
      side.forEach((e, rank) => (info.get(e).laneSum = (info.get(e).laneSum ?? 0) + sign * lane(rank, side.length)));
    });
  };
  outs.forEach((group, id) => laneFor(group, (e) => cy(e.target) - cy(id), 1));
  ins.forEach((group, id) => laneFor(group, (e) => cy(e.source) - cy(id), -1));

  // 3. Geometry per edge: ports first, then one conflict-free vertical lane for every forward edge
  const geo = list.map((e) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    const sx = s.position.x + RIGHT_PORT_X + HANDLE_SIZE / 2;
    const sy = s.position.y + portY(info.get(e).out, outs.get(e.source).length);
    const tx = t.position.x + LEFT_PORT_X - HANDLE_SIZE / 2;
    const ty = t.position.y + portY(info.get(e).in, ins.get(e.target).length);
    const forward = tx > sx + 80;
    const offset = forward ? 24 : 30 + 22 * (info.get(e).out ?? 0); // back edges loop around; stagger them by port
    return { e, sx, sy, tx, ty, forward, offset, x: null };
  });

  // A forward track is: right from the source, down/up a vertical run at x = lane, right into the target.
  // Lanes are handed out greedily (longest vertical runs first). Each edge prefers the lane the ordering heuristic
  // above suggests (centre + laneSum, which avoids crossings), then tries lanes LANE px further out on alternating
  // sides, and takes the first one at least LANE px from every vertical run it shares height with.
  const runs = []; // vertical runs already placed: { x, y1, y2 }
  const margin = LANE / 2; // also keep runs apart in y, so end-to-end runs don't touch
  [...geo].filter((g) => g.forward).sort((a, b) => Math.abs(b.ty - b.sy) - Math.abs(a.ty - a.sy)).forEach((g) => {
    const lo = g.sx + g.offset + 8;
    const hi = g.tx - g.offset - 8;
    const y1 = Math.min(g.sy, g.ty) - margin;
    const y2 = Math.max(g.sy, g.ty) + margin;
    const free = (x) => runs.every((r) => y2 < r.y1 || y1 > r.y2 || Math.abs(x - r.x) >= LANE);
    const clamp = (x) => Math.max(lo, Math.min(hi, x));
    const preferred = clamp((lo + hi) / 2 + (info.get(g.e).laneSum ?? 0));
    let chosen = null;
    for (let k = 0; k <= Math.ceil((hi - lo) / LANE) && chosen === null; k++) {
      for (const x of k === 0 ? [preferred] : [preferred + k * LANE, preferred - k * LANE]) {
        if (x >= lo && x <= hi && free(x)) {
          chosen = x;
          break;
        }
      }
    }
    g.x = chosen ?? preferred; // no free lane in this gap: share the preferred one rather than break the route
    runs.push({ x: g.x, y1, y2 });
  });

  const routes = geo.map((g) => {
    let stepPosition = 0.5;
    if (g.forward) {
      const usable = g.tx - g.sx - 2 * g.offset;
      stepPosition = usable > 0 ? (g.x - (g.sx + g.offset)) / usable : 0.5;
    }
    const [path] = getSmoothStepPath({
      sourceX: g.sx, sourceY: g.sy, sourcePosition: Position.Right,
      targetX: g.tx, targetY: g.ty, targetPosition: Position.Left,
      borderRadius: BORDER_RADIUS, offset: g.offset, stepPosition,
    });
    return { edge: g.e, segs: straightSegments(path), stepPosition, offset: g.offset };
  });

  // 4. Label signs, beside the track. Most constrained (shortest straight runs) first.
  const nodeRects = nodes.map((n) => ({
    x1: n.position.x, y1: n.position.y, x2: n.position.x + NODE_WIDTH + 6, y2: n.position.y + NODE_HEIGHT + 6,
  }));
  const placed = [];
  const placements = new Map();
  const labelled = routes.filter((r) => r.edge.label && r.segs.length);
  const longest = (r) => Math.max(...r.segs.map((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1)));
  labelled.sort((a, b) => longest(a) - longest(b));

  for (const r of labelled) {
    const w = shortLabel(r.edge.label).length * CHAR_W + 28;
    const segOrder = r.segs
      .map((seg, i) => ({ seg, len: Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) }))
      .sort((a, b) => b.len - a.len)
      .slice(0, 3);
    let best = null;

    segOrder.forEach(({ seg, len }, si) => {
      const vertical = Math.abs(seg.x2 - seg.x1) < 1;
      for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) {
        for (const side of [1, -1]) {
          const px = seg.x1 + (seg.x2 - seg.x1) * t;
          const py = seg.y1 + (seg.y2 - seg.y1) * t;
          const c = vertical
            ? { x: px + side * (LABEL_GAP + w / 2), y: py }
            : { x: px, y: py + side * (LABEL_GAP + LABEL_H / 2) };
          const rect = { x1: c.x - w / 2, y1: c.y - LABEL_H / 2, x2: c.x + w / 2, y2: c.y + LABEL_H / 2 };

          let cost = si * 6 + Math.abs(t - 0.5) * 20 + (side === 1 ? 0 : 2) + (len < 40 ? 50 : 0);
          cost += nodeRects.filter((n) => overlaps(rect, n, 8)).length * 1000;
          cost += placed.filter((p) => overlaps(rect, p, 6)).length * 1000;
          for (const other of routes) {
            for (const s of other.segs) {
              if (s === seg) continue;
              const box = { x1: Math.min(s.x1, s.x2), y1: Math.min(s.y1, s.y2), x2: Math.max(s.x1, s.x2), y2: Math.max(s.y1, s.y2) };
              if (overlaps(rect, box, 12)) cost += 30;
            }
          }
          if (!best || cost < best.cost) {
            const q = vertical ? { x: px + side * LABEL_GAP, y: py } : { x: px, y: py + side * LABEL_GAP };
            best = { cost, rect, placement: { cx: c.x, cy: c.y, w, h: LABEL_H, px, py, qx: q.x, qy: q.y } };
          }
        }
      }
    });
    if (best) {
      placed.push(best.rect);
      placements.set(r.edge, best.placement);
    }
  }

  // 5. Hand the results back on the nodes / edges
  const routeOf = new Map(routes.map((r) => [r.edge, r]));
  const routedEdges = edges.map((e) => {
    const r = routeOf.get(e);
    if (!r) return { ...e, type: "rail" };
    return {
      ...e,
      type: "rail",
      sourceHandle: `out-${info.get(e).out}`,
      targetHandle: `in-${info.get(e).in}`,
      data: { ...e.data, stepPosition: r.stepPosition, offset: r.offset, labelPlacement: placements.get(e) },
    };
  });
  const routedNodes = nodes.map((n) => ({
    ...n,
    data: { ...n.data, ports: { in: Math.max(1, ins.get(n.id)?.length ?? 0), out: Math.max(1, outs.get(n.id)?.length ?? 0) } },
  }));
  // Obstacles for scenery placement: each track as a polyline through its straight pieces, plus the label signs
  const tracks = routes.map((r) => r.segs.flatMap((s) => [[s.x1, s.y1], [s.x2, s.y2]]));
  return { nodes: routedNodes, edges: routedEdges, tracks, labelRects: placed };
}
