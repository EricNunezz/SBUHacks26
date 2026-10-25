import { useEffect, useState } from "react";
import { useViewport } from "@xyflow/react";
import { gridProps } from "@/theme/flow";

// ---- Tweak these ----
export const GRASS = "#5FA343";
export const DRY_GRASS = "#A8B75A";
export const DRY_GRASS_LIGHT = "#B9C26A";
export const DARK_GRASS = "#4C8A36";
const PATCH_STRENGTH = { dark: 0.55, dry: 0.6, spot: 0.45 };
const GRASS_SEED = 7;
const TILE = 1024;
const TEXTURE_PX = 512;
const GRAIN = 0.035;

const GRID_RGB = "62, 122, 44"; // #3E7A2C
const GRID_ALPHA = 0.12; // very subtle
const GRID_GAP = gridProps.gap * 2; // twice the old cell size
const GRID_FADE = { from: 0.35, to: 0.85 };

// ---- Texture: plain canvas math, generated once, no SVG filters ----
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

// Seamless fractal value noise: returns f(u, v) in 0..1 for u, v in 0..1 (wraps at the edges)
function makeNoise(seed, cells, octaves = 4) {
  const rand = rng(seed);
  const grids = [];
  for (let o = 0; o < octaves; o++) {
    const n = cells * 2 ** o;
    grids.push({ n, v: Float32Array.from({ length: n * n }, rand) });
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (const { n, v: g } of grids) {
      const x = u * n;
      const y = v * n;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = smooth(x - x0);
      const fy = smooth(y - y0);
      const xa = x0 % n;
      const xb = (x0 + 1) % n;
      const ya = y0 % n;
      const yb = (y0 + 1) % n;
      const top = g[ya * n + xa] * (1 - fx) + g[ya * n + xb] * fx;
      const bottom = g[yb * n + xa] * (1 - fx) + g[yb * n + xb] * fx;
      sum += (top * (1 - fy) + bottom * fy) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const ramp = (v, lo, hi) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));

let cachedUrl = null;
export function makeTexture() {
  if (cachedUrl) return cachedUrl;
  const size = TEXTURE_PX;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);

  const layers = [
    {
      noise: makeNoise(GRASS_SEED + 14, 3),
      color: rgb(DARK_GRASS),
      lo: 0.5,
      hi: 0.68,
      k: PATCH_STRENGTH.dark,
    },
    {
      noise: makeNoise(GRASS_SEED, 4),
      color: rgb(DRY_GRASS),
      lo: 0.52,
      hi: 0.7,
      k: PATCH_STRENGTH.dry,
    },
    {
      noise: makeNoise(GRASS_SEED + 4, 8),
      color: rgb(DRY_GRASS_LIGHT),
      lo: 0.58,
      hi: 0.74,
      k: PATCH_STRENGTH.spot,
    },
  ];
  const base = rgb(GRASS);
  const grain = rng(GRASS_SEED + 99);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const u = px / size;
      const v = py / size;
      let [r, g, b] = base;
      for (const l of layers) {
        const a = ramp(l.noise(u, v), l.lo, l.hi) * l.k;
        r += (l.color[0] - r) * a;
        g += (l.color[1] - g) * a;
        b += (l.color[2] - b) * a;
      }
      const shade = 1 + (grain() - 0.5) * 2 * GRAIN;
      const i = (py * size + px) * 4;
      img.data[i] = r * shade;
      img.data[i + 1] = g * shade;
      img.data[i + 2] = b * shade;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cachedUrl = canvas.toDataURL("image/png");
  return cachedUrl;
}

// Game-board background inside <ReactFlow>. React Flow's viewport is { x, y, zoom }: the diagram is drawn
// translated by (x, y) and scaled by zoom. The same numbers drive two plain CSS backgrounds:
//  - grass: the texture tile drawn at TILE*zoom px, positioned at (x, y)
//  - grid: cells of GRID_GAP*zoom px, positioned at (x, y)
// One container-sized div per layer (no oversized layers, no filters), so Safari has nothing to smear.
export default function GrassBackground() {
  const { x, y, zoom } = useViewport();
  const [texture, setTexture] = useState(cachedUrl);

  useEffect(() => {
    if (!texture) setTexture(makeTexture()); // once, after first paint of the flat colour
  }, [texture]);

  const tile = Math.round(TILE * zoom * 100) / 100;
  const cell = Math.round(GRID_GAP * zoom * 100) / 100;
  const px = Math.round(x);
  const py = Math.round(y);
  const gridOpacity = Math.min(
    1,
    Math.max(0, (zoom - GRID_FADE.from) / (GRID_FADE.to - GRID_FADE.from)),
  );
  const line = `rgba(${GRID_RGB}, ${GRID_ALPHA})`;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: -1,
        backgroundColor: GRASS,
        backgroundImage: texture ? `url(${texture})` : undefined,
        backgroundSize: `${tile}px ${tile}px`,
        backgroundPosition: `${px}px ${py}px`,
      }}
    >
      {gridOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: gridOpacity,
            backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
            backgroundSize: `${cell}px ${cell}px`,
            backgroundPosition: `${px}px ${py}px`,
          }}
        />
      )}
    </div>
  );
}
