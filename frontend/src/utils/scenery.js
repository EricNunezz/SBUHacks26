import { NODE_WIDTH, NODE_HEIGHT } from "@/utils/layout";
import { KINDS, PLACEMENT } from "@/theme/scenery";

// Seeded RNG, so a repo always gets the same scenery
function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const distToRect = (x, y, r) => Math.hypot(Math.max(r.x1 - x, 0, x - r.x2), Math.max(r.y1 - y, 0, y - r.y2));

function distToSegment(x, y, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2)) : 0;
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

/**
 * Scatter decorations over empty ground. A candidate is kept only if its footprint (a circle) stays clear of
 * every station, track, label sign and earlier decoration by the margins in theme/scenery.js.
 * Returns [{ id, kind, x, y, w, h, scale, flip }] with x/y as the top-left corner.
 */
export function placeScenery(seedKey, stations, tracks, labelRects, overrides = {}) {
  if (!stations.length) return [];
  const { cell, maxTotal, scale: scaleRange, outerPadding, density, clearance } = { ...PLACEMENT, ...overrides };
  const rand = rng(hash(seedKey));

  const rects = stations.map((n) => ({
    x1: n.position.x, y1: n.position.y, x2: n.position.x + NODE_WIDTH, y2: n.position.y + NODE_HEIGHT,
  }));
  // Track polylines as segment list
  const segments = tracks.flatMap((pts) => pts.slice(1).map((p, i) => [pts[i], p]));

  // Area to fill: the stations' bounding box plus padding
  const box = {
    x1: Math.min(...rects.map((r) => r.x1)) - outerPadding, y1: Math.min(...rects.map((r) => r.y1)) - outerPadding,
    x2: Math.max(...rects.map((r) => r.x2)) + outerPadding, y2: Math.max(...rects.map((r) => r.y2)) + outerPadding,
  };
  const cx = (box.x1 + box.x2) / 2;
  const cy = (box.y1 + box.y2) / 2;
  const hw = (box.x2 - box.x1) / 2;
  const hh = (box.y2 - box.y1) / 2;

  // Every cell once, in seeded random order (Fisher-Yates), so the cap cuts evenly across the map
  const cells = [];
  for (let y = box.y1; y < box.y2; y += cell) for (let x = box.x1; x < box.x2; x += cell) cells.push([x, y]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const kinds = Object.entries(KINDS);
  const totalWeight = kinds.reduce((s, [, k]) => s + k.weight, 0);
  const pickKind = () => {
    let t = rand() * totalWeight;
    for (const [name, k] of kinds) if ((t -= k.weight) <= 0) return name;
    return kinds[0][0];
  };

  const placed = [];
  for (const [cellX, cellY] of cells) {
    if (placed.length >= maxTotal) break;

    // Sparse in the middle, dense at the edge: chance rises with normalised distance from the centre
    const px = cellX + rand() * cell;
    const py = cellY + rand() * cell;
    const radial = Math.hypot((px - cx) / hw, (py - cy) / hh);
    const s = Math.min(1, Math.max(0, (radial - 0.25) / 0.5));
    const chance = density.middle + (density.outside - density.middle) * s * s * (3 - 2 * s);
    const kindRoll = rand();
    const scaleRoll = rand();
    const flipRoll = rand();
    if (kindRoll > chance) continue;

    const kind = pickKind();
    const { w, h } = KINDS[kind];
    const scale = scaleRange[0] + scaleRoll * (scaleRange[1] - scaleRange[0]);
    const r = (Math.max(w, h) * scale) / 2; // footprint radius
    const x = px;
    const y = py;

    if (rects.some((rc) => distToRect(x, y, rc) - r < clearance.station)) continue;
    if (segments.some(([a, b]) => distToSegment(x, y, a, b) - r < clearance.track)) continue;
    if (labelRects.some((rc) => distToRect(x, y, rc) - r < clearance.label)) continue;
    if (placed.some((p) => Math.hypot(x - p.cx, y - p.cy) - r - p.r < clearance.between)) continue;

    placed.push({
      id: `scenery-${placed.length}`, kind, cx: x, cy: y, r, w: w * scale, h: h * scale, scale, flip: flipRoll < 0.5,
    });
  }

  return placed.map((p) => ({
    id: p.id, kind: p.kind, x: p.cx - p.w / 2, y: p.cy - p.h / 2, scale: p.scale, flip: p.flip,
  }));
}
