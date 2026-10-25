import { useState } from "react";
import TrainGraphic from "@/components/TrainGraphic";
import { MUTED, langColor } from "@/components/stats/parts";

// Language share as a freight train: a locomotive (facing right) pulling exactly 10 identical boxcars, each worth 10%
// of the code. Everything is drawn in one SVG with a fixed viewBox, so it scales to the card width (no horizontal
// scroll) and every car keeps its shape. Static by default: the engine's wheels are paused and its smoke is hidden.
const IRON = "#2B2D31";
const CARS = 10;
const CAR_W = 44;
const CAR_H = 28;
const COUPLER = 6;
const PAD = 8;
const LOCO_W = 78;
const LOCO_H = (LOCO_W * 58) / 96;
const BASE = 64; // y of the wheels' lowest point (the rail top): the cars' and the engine's wheels all end here
const WHEEL_R = 3.6; // car wheels, 20% smaller than the first version (4.5)
const LOCO_Y = BASE - (LOCO_H * 48) / 58; // the engine's top, so its wheels end on BASE
const COUPLER_Y = LOCO_Y + (LOCO_H * 38) / 58; // same height as the engine's own coupling bar, so everything joins up
const VB_W = PAD + CARS * CAR_W + (CARS - 1) * COUPLER + COUPLER + LOCO_W + PAD;
const VB_H = 84;
const OTHER_COLOR = "#6B7280";

const pctLabel = (p) => (p < 1 ? "<1%" : `${Math.round(p)}%`);

// 10 cars by largest remainder: everyone gets floor(percent / 10), the leftover cars go to the biggest remainders
// (ties to the bigger share), so the total is always exactly 10.
function allocate(items) {
  const quota = items.map((it) => it.percent / 10);
  const cars = quota.map(Math.floor);
  let left = CARS - cars.reduce((a, b) => a + b, 0);
  const order = quota
    .map((q, i) => ({ i, rem: q - Math.floor(q), percent: items[i].percent }))
    .sort((a, b) => b.rem - a.rem || b.percent - a.percent);
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) cars[order[k].i]++;
  return cars;
}

// Cars per language. Languages under 5% are folded into one "Other" group (with the existing Other, if any); if that
// group earns no car its members only show up in the legend. Returns { groups, legend }; groups are biggest first.
function buildTrain(languages) {
  const coloured = languages.map((l, i) => ({ ...l, color: langColor(l, i) }));
  const small = coloured.filter((l) => l.percent < 5);
  const big = coloured.filter((l) => l.percent >= 5 && l.name !== "Other");
  const otherBig = coloured.find((l) => l.percent >= 5 && l.name === "Other");
  const pool = [...small, ...(otherBig ? [otherBig] : [])];
  const items = [...big];
  if (pool.length) {
    items.push({
      name: "Other",
      percent: pool.reduce((s, l) => s + l.percent, 0),
      bytes: pool.reduce((s, l) => s + l.bytes, 0),
      color: OTHER_COLOR,
      members: pool,
    });
  }
  const cars = allocate(items);
  const groups = items
    .map((it, i) => ({ ...it, cars: cars[i] }))
    .filter((g) => g.cars > 0)
    .sort((a, b) => b.cars - a.cars || b.percent - a.percent);
  const otherGotCar = groups.some((g) => g.members);
  const legend = coloured.map((l) => ({
    ...l,
    // under-5% languages that got no car have a hollow swatch
    color: l.percent < 5 && !otherGotCar ? null : l.percent < 5 ? OTHER_COLOR : l.color,
  }));
  return { groups, legend };
}

function Boxcar({ x, color, active }) {
  const y = BASE - 2 * WHEEL_R - CAR_H; // the body rests on the wheels
  return (
    <g>
      {/* couplers are drawn by the caller; wheels first so the body overlaps their tops */}
      {[CAR_W * 0.25, CAR_W * 0.75].map((cx) => (
        <circle key={cx} cx={x + cx} cy={BASE - WHEEL_R} r={WHEEL_R} fill={IRON} stroke={IRON} strokeWidth="1" />
      ))}
      <rect x={x} y={y} width={CAR_W} height={CAR_H} rx="2" fill={color} stroke={active ? "#B87333" : IRON} strokeWidth={active ? 4 : 2.5} />
      {[7, 14, 30, 37].map((rx) => (
        <line key={rx} x1={x + rx} y1={y + 3} x2={x + rx} y2={y + CAR_H - 3} stroke={IRON} strokeWidth="1.2" opacity="0.35" />
      ))}
      <rect x={x + 15} y={y + 5} width="14" height={CAR_H - 6} fill={IRON} fillOpacity="0.18" stroke={IRON} strokeWidth="2" />
      <line x1={x + 22} y1={y + 5} x2={x + 22} y2={y + CAR_H - 1} stroke={IRON} strokeWidth="1.5" />
    </g>
  );
}

export default function FreightTrain({ languages, format }) {
  const [hover, setHover] = useState(null); // group index
  const { groups, legend } = buildTrain(languages);

  // Cars left to right: smallest group first, so the biggest ends up next to the locomotive on the right
  const ordered = [...groups].reverse();
  let slot = 0;
  const placed = ordered.flatMap((g, gi) =>
    Array.from({ length: g.cars }, () => ({ group: g, groupIndex: groups.indexOf(g), x: PAD + slot++ * (CAR_W + COUPLER) })),
  );
  const locoX = PAD + CARS * (CAR_W + COUPLER);
  const tip = hover === null ? null : groups[hover];
  const tipCar = placed.filter((c) => c.groupIndex === hover);
  const tipX = tipCar.length ? (tipCar[0].x + (tipCar[tipCar.length - 1].x + CAR_W)) / 2 : 0;

  const describe = (g) => `${g.name}, ${pctLabel(g.percent)}, ${format(g.bytes)}`;

  return (
    <div className="space-y-2">
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="block h-auto w-full"
          role="group"
          aria-label={`Freight train, one car per 10% of the code: ${groups.map((g) => `${g.name} ${g.cars}`).join(", ")}`}
        >
          {/* track: ties, then the rails on top */}
          {Array.from({ length: Math.floor((VB_W - 8) / 10) }, (_, i) => (
            <rect key={i} x={6 + i * 10} y={BASE + 3} width="6" height="9" fill="#7A5230" stroke={IRON} strokeWidth="1.5" />
          ))}
          <rect x="2" y={BASE} width={VB_W - 4} height="5" rx="1" fill="#8A8F98" stroke={IRON} strokeWidth="2" />

          {/* couplers between cars, and from the last car to the engine */}
          {Array.from({ length: CARS }, (_, i) => (
            <line key={i} x1={PAD + i * (CAR_W + COUPLER) + CAR_W - 1} y1={COUPLER_Y} x2={PAD + (i + 1) * (CAR_W + COUPLER) + 2} y2={COUPLER_Y} stroke={IRON} strokeWidth="3" strokeLinecap="round" />
          ))}

          {placed.map((c, i) => (
            <g
              key={i}
              tabIndex={0}
              role="img"
              aria-label={describe(c.group)}
              className="outline-none"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(c.groupIndex)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(c.groupIndex)}
              onBlur={() => setHover(null)}
            >
              <title>{describe(c.group)}</title>
              <Boxcar x={c.x} color={c.group.color} active={hover === c.groupIndex} />
            </g>
          ))}

          <svg x={locoX} y={LOCO_Y} width={LOCO_W} height={LOCO_H} aria-hidden="true">
            <TrainGraphic className="train-still train-calm" />
          </svg>
        </svg>

        {tip && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border-2 border-[#2B2D31] bg-[#FBF9F5] px-2 py-1 font-mono text-xs shadow-[2px_2px_0_#2B2D31]"
            style={{ left: `${(tipX / VB_W) * 100}%`, top: "-4px", transform: "translate(-50%, -100%)" }}
          >
            <div className="font-bold">{tip.name}</div>
            <div>{pctLabel(tip.percent)} · {format(tip.bytes)}</div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
        {legend.map((l) => (
          <span key={l.name} className="flex items-center gap-1.5">
            <span
              className={`inline-block size-3 border-2 ${l.color ? "border-[#2B2D31]" : "border-dashed border-[#8A8F98]"}`}
              style={l.color ? { backgroundColor: l.color } : undefined}
            />
            {l.name} {pctLabel(l.percent)}
          </span>
        ))}
      </div>
      <p className="font-mono text-[11px]" style={{ color: MUTED }}>Each car = 10% of the code</p>
    </div>
  );
}
