import { useCallback, useEffect, useRef, useState } from "react";

// Progress is a guess (the backend reports none), so it eases toward a ceiling and never
// reaches 100 by itself. Each frame it moves a fraction of the remaining distance:
//   p += (target - p) * (1 - e^(-dt / tau))
// Fast at first, slower as p nears the target. Using dt keeps it frame-rate independent,
// and a throttled background tab just takes one bigger step when it wakes up.
const EASE_TARGET = 90;
const EASE_TAU = 8; // seconds; reaches ~88% after 30s
const SLOW_AFTER = 45; // seconds; past this the ceiling lifts and the creep gets gentle
const SLOW_TARGET = 98; // never 100: only finish() gets there
const SLOW_TAU = 40;
const FINISH_TAU = 0.12; // quick snap to 100
const HOLD_MS = 400;

// start() begins easing from 0, finish() resolves after reaching 100 and a short hold,
// stop() freezes it (for errors). `slow` flips true once the request runs long.
export default function useEstimatedProgress() {
  const [state, setState] = useState({ progress: 0, slow: false });
  const raf = useRef(0);
  const value = useRef(0);

  const halt = useCallback(() => cancelAnimationFrame(raf.current), []);

  // Calls step(dt, elapsed) in seconds every frame until it returns false
  const loop = useCallback((step) => {
    const t0 = performance.now();
    let last = t0;
    const frame = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      if (step(dt, (now - t0) / 1000) !== false) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  }, []);

  const start = useCallback(() => {
    halt();
    value.current = 0;
    setState({ progress: 0, slow: false });
    loop((dt, elapsed) => {
      const slow = elapsed > SLOW_AFTER;
      const target = slow ? SLOW_TARGET : EASE_TARGET;
      const tau = slow ? SLOW_TAU : EASE_TAU;
      value.current += (target - value.current) * (1 - Math.exp(-dt / tau));
      setState({ progress: value.current, slow });
    });
  }, [halt, loop]);

  const finish = useCallback(
    () =>
      new Promise((resolve) => {
        halt();
        loop((dt) => {
          value.current += (100 - value.current) * (1 - Math.exp(-dt / FINISH_TAU));
          const done = value.current > 99.5;
          if (done) value.current = 100;
          setState((s) => ({ ...s, progress: value.current }));
          if (done) setTimeout(resolve, HOLD_MS);
          return !done;
        });
      }),
    [halt, loop]
  );

  useEffect(() => halt, [halt]);

  return { ...state, start, finish, stop: halt };
}
