// THE cartoon steam train: the single drawing used by the tour train, the loaders and the progress screen.
// It faces RIGHT: smokestack, boiler and cowcatcher on the right, cab and coupling on the left. Anything that moves it
// left must mirror it (scaleX(-1)) so the front still leads. 96x58, wheels' lowest point at y = 48.
//
// Layers: the body is drawn once facing left and mirrored by the <g> below. The wheel spokes and the smoke are NOT
// inside that mirror, so they are drawn in screen space: the spokes turn clockwise (the way a wheel rolls when the
// train moves right; a mirrored train then turns them counter-clockwise, correctly) and the smoke drifts toward -x,
// away from the front. Animations (.tl-wheel, .tl-smoke) live in index.css and respect prefers-reduced-motion.
// Wrap it in className="train-still" to pause the wheels while the train is parked.
const IRON = "var(--iron)";
const W = 96;
const WHEELS = [22, 56, 74]; // wheel centres, facing right
const STACK_X = 71; // smokestack centre, facing right

export const TRAIN_W = W;
export const TRAIN_H = 58;
export const TRAIN_WHEEL_BOTTOM = 48;

export default function TrainGraphic({ className = "" }) {
  return (
    <svg viewBox="0 0 96 58" width="100%" height="100%" fill="none" strokeLinejoin="round" strokeLinecap="round" className={className} aria-hidden="true" focusable="false">
      <circle className="tl-smoke" cx={STACK_X} cy="9" r="5" fill="#fff" stroke={IRON} strokeWidth="2" />
      <circle className="tl-smoke tl-smoke-2" cx={STACK_X} cy="9" r="4" fill="#fff" stroke={IRON} strokeWidth="2" />
      {/* body, drawn facing left and mirrored so it faces right */}
      <g transform={`translate(${W} 0) scale(-1 1)`}>
        <path d="M20 22 V14 H30 V22" fill={IRON} stroke={IRON} strokeWidth="2" />
        <rect x="10" y="22" width="52" height="18" rx="7" fill="#B87333" stroke={IRON} strokeWidth="2.5" />
        <rect x="30" y="17" width="8" height="6" rx="3" fill="#E2C25A" stroke={IRON} strokeWidth="2" />
        <rect x="56" y="12" width="30" height="30" rx="4" fill="#C0432B" stroke={IRON} strokeWidth="2.5" />
        <rect x="53" y="8" width="36" height="6" rx="2" fill={IRON} />
        <rect x="62" y="18" width="16" height="12" rx="2" fill="#A9D4EE" stroke={IRON} strokeWidth="2" />
        <path d="M10 40 L3 46 H16 Z" fill="#E2C25A" stroke={IRON} strokeWidth="2" />
        <line x1="86" y1="38" x2="94" y2="38" stroke={IRON} strokeWidth="3" />
        {[22, 40, 74].map((cx) => (
          <circle key={cx} cx={cx} cy="42" r="6" fill="#16171A" stroke={IRON} strokeWidth="2" />
        ))}
      </g>
      {WHEELS.map((cx) => (
        <g key={cx} className="tl-wheel">
          <line x1={cx - 4} y1="42" x2={cx + 4} y2="42" stroke="#8A8F98" strokeWidth="1.8" />
          <line x1={cx} y1="38" x2={cx} y2="46" stroke="#8A8F98" strokeWidth="1.8" />
        </g>
      ))}
    </svg>
  );
}
