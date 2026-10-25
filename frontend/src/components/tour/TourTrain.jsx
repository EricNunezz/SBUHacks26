import { useEffect, useLayoutEffect, useRef } from "react";
import { ViewportPortal } from "@xyflow/react";
import { NODE_HEIGHT, NODE_WIDTH } from "@/utils/layout";
import TrainGraphic, { TRAIN_H, TRAIN_W } from "@/components/TrainGraphic";

// Drawn in flow coordinates (inside the viewport), so it pans and zooms with the stations: ~40% of a station's width.
// TrainGraphic is 100% x 100% of its box, so the box needs an explicit size.
const WIDTH = NODE_WIDTH * 0.4;
const HEIGHT = (WIDTH * TRAIN_H) / TRAIN_W;
const ANCHOR = { x: WIDTH / 2, y: (HEIGHT * 46) / TRAIN_H }; // the wheels' contact line, so the train sits on the rails
const MAX_TILT = 25; // degrees: follow gentle curves, but stay upright on the vertical bits of a track

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

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
  const lastAt = useRef(null); // station the train was last parked at (to face the next one when it jumps)
  // Nose direction (left / right) plus a tilt to the track's tangent, in degrees. With the mirrored picture the
  // forward vector points at 180 degrees, so the rotation is measured from there.
  const face = (left, tilt = 0) => {
    if (bodyRef.current) bodyRef.current.style.transform = `rotate(${tilt}deg) scaleX(${left ? -1 : 1})`;
  };

  const place = (x, y) => {
    wrapRef.current.style.transform = `translate(${x - ANCHOR.x}px, ${y - ANCHOR.y}px)`;
  };

  // Parked: glide to the platform (no glide on first placement, or while faded out)
  useLayoutEffect(() => {
    if (travel || !at || !wrapRef.current) return;
    const el = wrapRef.current;
    el.style.transition = placed.current && !hidden ? "transform 0.35s ease-in-out, opacity 0.25s" : "opacity 0.25s";
    place(at.position.x + NODE_WIDTH / 2, at.position.y + NODE_HEIGHT - 4);
    // No track between the stops: nose toward the station it is going to
    if (lastAt.current && lastAt.current !== at) face(at.position.x < lastAt.current.position.x, 0);
    lastAt.current = at;
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
    let lastLeft = false;
    // Which way the nose should point at `along`: toward where the train is heading. On a vertical stretch of track
    // look further ahead for the next sideways bit; null = keep the current facing.
    const dir = travel.reverse ? -1 : 1;
    const facingLeft = (along) => {
      const here = path.getPointAtLength(along);
      for (const look of [8, 24, 60, 120, length]) {
        const ahead = path.getPointAtLength(Math.min(length, Math.max(0, along + dir * look)));
        if (Math.abs(ahead.x - here.x) > 2) return ahead.x < here.x;
      }
      return null;
    };
    // Tilt to follow the track: the angle of the direction of travel, relative to the nose, clamped
    const tiltAt = (along, left) => {
      const a = path.getPointAtLength(Math.max(0, Math.min(length, along - dir * 4)));
      const b = path.getPointAtLength(Math.max(0, Math.min(length, along + dir * 4)));
      let deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI; // direction of travel
      if (left) deg -= deg > 0 ? 180 : -180; // measured from the leftward nose
      return Math.max(-MAX_TILT, Math.min(MAX_TILT, deg));
    };
    // Point the nose the right way before the first frame, so it never starts out facing backwards
    const startAlong = travel.reverse ? length : 0;
    const start = facingLeft(startAlong);
    if (start !== null) {
      lastLeft = start;
      face(start, tiltAt(startAlong, start));
    }
    const tick = (now) => {
      startedAt ??= now;
      const t = Math.min(1, (now - startedAt) / travel.duration);
      const along = travel.reverse ? (1 - ease(t)) * length : ease(t) * length;
      const p = path.getPointAtLength(along);
      place(p.x, p.y);
      const left = facingLeft(along);
      if (left !== null) lastLeft = left;
      face(lastLeft, tiltAt(along, lastLeft));
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
        style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, zIndex: 30, pointerEvents: "none", opacity: hidden ? 0 : 1 }}
      >
        <div ref={bodyRef} style={{ width: "100%", height: "100%", transformOrigin: "50% 50%", transition: "transform 0.15s linear" }}>
          <TrainGraphic className={travel ? "" : "train-still"} />
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
