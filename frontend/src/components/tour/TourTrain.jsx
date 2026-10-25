import { useEffect, useLayoutEffect, useRef } from "react";
import { ViewportPortal } from "@xyflow/react";
import { NODE_HEIGHT, NODE_WIDTH } from "@/utils/layout";

const WIDTH = 96;
const HEIGHT = 58;
const ANCHOR = { x: 48, y: 46 }; // the wheels' contact line, so the train sits on the rails

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// A small cartoon steam engine drawn facing right (the body is mirrored when it heads left)
function Engine() {
  const iron = "var(--iron)";
  return (
    <svg width={WIDTH} height={HEIGHT} viewBox="0 0 96 58" fill="none" strokeLinejoin="round" strokeLinecap="round">
      {/* smoke puffs */}
      <circle className="tour-smoke" cx="24" cy="9" r="5" fill="#fff" stroke={iron} strokeWidth="2" />
      <circle className="tour-smoke tour-smoke-2" cx="24" cy="9" r="4" fill="#fff" stroke={iron} strokeWidth="2" />
      {/* chimney and boiler */}
      <path d="M20 22 V14 H30 V22" fill={iron} stroke={iron} strokeWidth="2" />
      <rect x="10" y="22" width="52" height="18" rx="7" fill="#B87333" stroke={iron} strokeWidth="2.5" />
      <rect x="30" y="17" width="8" height="6" rx="3" fill="#E2C25A" stroke={iron} strokeWidth="2" />
      {/* cab */}
      <rect x="56" y="12" width="30" height="30" rx="4" fill="#C0432B" stroke={iron} strokeWidth="2.5" />
      <rect x="53" y="8" width="36" height="6" rx="2" fill={iron} />
      <rect x="62" y="18" width="16" height="12" rx="2" fill="#A9D4EE" stroke={iron} strokeWidth="2" />
      {/* cowcatcher and coupling */}
      <path d="M10 40 L3 46 H16 Z" fill="#E2C25A" stroke={iron} strokeWidth="2" />
      <line x1="86" y1="38" x2="94" y2="38" stroke={iron} strokeWidth="3" />
      {/* wheels */}
      {[22, 40, 74].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="42" r="6" fill="#16171A" stroke={iron} strokeWidth="2" />
          <circle cx={cx} cy="42" r="1.8" fill="#8A8F98" />
        </g>
      ))}
    </svg>
  );
}

/**
 * The tour train. Parked, it sits on the platform of the station `at` (a routed node). While `travel` is set it runs
 * along that SVG path (flow coordinates, taken from the drawn track), easing in and out, then calls onArrive.
 * `hidden` fades it out (used between stations with no direct track).
 */
export default function TourTrain({ at, travel, hidden, onArrive }) {
  const wrapRef = useRef(null);
  const bodyRef = useRef(null);
  const pathRef = useRef(null);
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;
  const placed = useRef(false);

  const place = (x, y) => {
    wrapRef.current.style.transform = `translate(${x - ANCHOR.x}px, ${y - ANCHOR.y}px)`;
  };

  // Parked: glide to the platform (no glide on first placement, or while faded out)
  useLayoutEffect(() => {
    if (travel || !at || !wrapRef.current) return;
    const el = wrapRef.current;
    el.style.transition = placed.current && !hidden ? "transform 0.35s ease-in-out, opacity 0.25s" : "opacity 0.25s";
    place(at.position.x + NODE_WIDTH / 2, at.position.y + NODE_HEIGHT - 4);
    placed.current = true;
  }, [at, travel, hidden]);

  // Running: follow the path with requestAnimationFrame (time based, so a slow frame never changes the duration)
  useEffect(() => {
    if (!travel) return;
    const path = pathRef.current;
    const length = path.getTotalLength();
    wrapRef.current.style.transition = "opacity 0.25s";
    let raf;
    let startedAt = null;
    let lastX = null;
    const tick = (now) => {
      startedAt ??= now;
      const t = Math.min(1, (now - startedAt) / travel.duration);
      const along = travel.reverse ? (1 - ease(t)) * length : ease(t) * length;
      const p = path.getPointAtLength(along);
      place(p.x, p.y);
      if (lastX !== null && Math.abs(p.x - lastX) > 0.4) {
        bodyRef.current.style.transform = p.x < lastX ? "scaleX(-1)" : "scaleX(1)";
      }
      lastX = p.x;
      if (t < 1) raf = requestAnimationFrame(tick);
      else arriveRef.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [travel]);

  return (
    <ViewportPortal>
      <div
        ref={wrapRef}
        aria-hidden
        style={{ position: "absolute", left: 0, top: 0, zIndex: 30, pointerEvents: "none", opacity: hidden ? 0 : 1 }}
      >
        <div ref={bodyRef} style={{ transformOrigin: "50% 50%" }}>
          <Engine />
        </div>
      </div>
      {travel && (
        <svg style={{ position: "absolute", width: 0, height: 0, overflow: "visible" }} aria-hidden>
          <path ref={pathRef} d={travel.d} fill="none" stroke="none" />
        </svg>
      )}
    </ViewportPortal>
  );
}
