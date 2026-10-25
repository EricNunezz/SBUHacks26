import { useEffect, useRef, useState } from "react";
import TrainGraphic, { TRAIN_H, TRAIN_W, TRAIN_WHEEL_BOTTOM } from "@/components/TrainGraphic";

const IRON = "var(--iron)";
const STATION_W = 70;
const TRACK_H = 16;

// Rail track `width` px wide. `solid` = laid track (strong); otherwise faint and dashed (still to come).
function Track({ width, solid }) {
  const ties = Array.from({ length: Math.floor(width / 14) }, (_, i) => i * 14 + 3);
  const stroke = solid ? 2 : 1.5;
  return (
    <svg width={width} height={TRACK_H} viewBox={`0 0 ${width} ${TRACK_H}`} aria-hidden="true" focusable="false" className="block" style={{ opacity: solid ? 1 : 0.4 }}>
      {ties.map((x) => (
        <rect key={x} x={x} y={5} width={8} height={10} fill="#7A5230" stroke={IRON} strokeWidth={stroke} strokeDasharray={solid ? undefined : "3 2"} />
      ))}
      <rect x="1" y="1" width={width - 2} height="5" rx="1" fill="#8A8F98" stroke={IRON} strokeWidth={stroke} strokeDasharray={solid ? undefined : "6 4"} />
    </svg>
  );
}

function Station({ name }) {
  return (
    <div className="absolute bottom-0 right-0 flex flex-col items-center" style={{ width: STATION_W }}>
      <div
        title={name}
        className="mb-1 max-w-[150px] truncate rounded-[4px] border-2 border-[var(--iron)] bg-[var(--cream)] px-1.5 py-0.5 font-mono text-[10px] font-bold shadow-[2px_2px_0_var(--iron)]"
      >
        {name}
      </div>
      <svg width={STATION_W} height="50" viewBox="0 0 70 50" aria-hidden="true" focusable="false">
        <polygon points="2,16 35,2 68,16" fill="#A0442C" stroke={IRON} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="6" y="16" width="58" height="34" fill="#D9C7A3" stroke={IRON} strokeWidth="2.5" />
        <rect x="12" y="24" width="12" height="12" fill="#9CC3D5" stroke={IRON} strokeWidth="2" />
        <rect x="46" y="24" width="12" height="12" fill="#9CC3D5" stroke={IRON} strokeWidth="2" />
        <path d="M29 50 V32 a6 6 0 0 1 12 0 V50 Z" fill="#7A5230" stroke={IRON} strokeWidth="2" />
      </svg>
    </div>
  );
}

/**
 * Determinate progress as a steam train running along a track toward a station. `progress` is 0-100, `name` is the repo
 * on the station's sign. The train moves with transform only. `error` stops the train (wheels and smoke pause) and
 * lights a red signal ahead of it. Wheels and smoke use the .tl-* styles, which respect prefers-reduced-motion.
 */
export default function TrainProgress({ progress, name, error = false }) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(520);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)));
    ro.observe(el);
    setWidth(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const p = Math.min(100, Math.max(0, progress));
  const endX = Math.max(width - STATION_W - TRAIN_W + 24, 0); // nose at the station door when done
  const x = (p / 100) * endX;
  const trackTop = TRAIN_WHEEL_BOTTOM - 4; // rails sit under the wheels
  const height = trackTop + TRACK_H + 4;
  const laid = Math.min(width, x + TRAIN_W * 0.6); // track behind the train is solid

  return (
    <div
      ref={boxRef}
      role="progressbar"
      aria-label="Mapping progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
      className={`relative w-full max-w-[520px] ${error ? "tp-stopped" : ""}`}
      style={{ height: height + 70 }}
    >
      <div className="absolute left-0 right-0" style={{ top: 22 }}>
        {/* percentage rides above the train */}
        <div
          className="absolute top-0 font-mono text-xs font-bold tabular-nums"
          style={{ transform: `translate3d(${x + TRAIN_W / 2 - 16}px, 0, 0)`, willChange: "transform" }}
        >
          {Math.round(p)}%
        </div>
        <div className="relative" style={{ marginTop: 20, height }}>
          <div className="absolute left-0" style={{ top: trackTop }}>
            <Track width={width} solid={false} />
          </div>
          <div className="absolute left-0 overflow-hidden" style={{ top: trackTop, width: laid }}>
            <Track width={width} solid />
          </div>
          <Station name={name} />
          <div
            className="absolute left-0 top-0"
            style={{ width: TRAIN_W, height: TRAIN_H, transform: `translate3d(${x}px, 0, 0)`, willChange: "transform" }}
          >
            <TrainGraphic />
          </div>
          {error && (
            <span
              className="signal-light absolute"
              style={{ left: Math.min(x + TRAIN_W + 14, width - STATION_W - 20), top: trackTop - 26 }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </div>
  );
}
