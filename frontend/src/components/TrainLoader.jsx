// An on-theme loading indicator for short, open-ended waits: a little steam train chugging back and forth on a short
// track, with spinning wheels and smoke. `size`: "lg" for full-board states, "sm" for inline ones (chat, panels).
// With prefers-reduced-motion the train stands still and only a smoke puff pulses slowly (see .train-loader in index.css).
import TrainGraphic, { TRAIN_W, TRAIN_H } from "@/components/TrainGraphic";

const IRON = "var(--iron)";
const SIZES = {
  lg: { s: 1, track: 260, text: "text-sm" },
  sm: { s: 0.6, track: 160, text: "text-[11px]" },
};

function Track({ width, s }) {
  const h = 16 * s;
  const ties = Array.from({ length: Math.floor(width / (14 * s)) }, (_, i) => i * 14 * s + 3 * s);
  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} aria-hidden="true" focusable="false" className="block">
      {ties.map((x) => (
        <rect key={x} x={x} y={5 * s} width={8 * s} height={10 * s} fill="#7A5230" stroke={IRON} strokeWidth={Math.max(1.5, 2 * s)} />
      ))}
      <rect x="1" y={1} width={width - 2} height={5 * s} rx="1" fill="#8A8F98" stroke={IRON} strokeWidth={Math.max(1.5, 2 * s)} />
    </svg>
  );
}

export default function TrainLoader({ message, size = "lg", className = "" }) {
  const { s, track, text } = SIZES[size] ?? SIZES.lg;
  const trainW = TRAIN_W * s;
  const trainH = TRAIN_H * s;
  return (
    <div role="status" aria-live="polite" className={`train-loader inline-flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: track, height: trainH + 8 * s }} aria-hidden="true">
        <div className="absolute left-0" style={{ top: trainH - 12 * s }}>
          <Track width={track} s={s} />
        </div>
        <div className="tl-run absolute left-0 top-0" style={{ width: trainW, height: trainH, "--run": `${track - trainW}px` }}>
          <div className="tl-face h-full w-full">
            <TrainGraphic />
          </div>
        </div>
      </div>
      {message && (
        <p
          className={`font-mono font-bold uppercase tracking-[0.16em] ${text} ${
            size === "lg" ? "rounded-md border-2 border-[var(--iron)] bg-[var(--cream)] px-3 py-1 text-[var(--iron)] shadow-[2px_2px_0_var(--iron)]" : "text-[var(--steel-text)]"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
