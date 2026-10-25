import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getExploreTour, getTour } from "@/api/client";
import { buildLocalTour } from "@/utils/localTour"; // TODO: remove with the fallback below once the backend tour is live
import { railPaths } from "@/utils/railPaths";

const FADE_MS = 250; // train fades out, the camera moves, then it reappears at the next station
const REAPPEAR_MS = 50;

// True when the user asked for less motion; follows changes to the setting
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// The edge that joins two stations directly (either direction), and whether the train runs against it
function findTrack(edges, a, b) {
  for (const edge of edges) {
    if (edge.source === a && edge.target === b) return { edge, reverse: false };
    if (edge.source === b && edge.target === a) return { edge, reverse: true };
  }
  return null;
}

/**
 * The Grand Tour state machine. `nodes` / `edges` are the board's routed stations and tracks and `frame(nodes, ms)`
 * moves the camera so those stations fill the visible part of the board. The tour never opens the NodePanel.
 * status: "idle" | "loading" | "running". While running: stops, index, visited (node ids), trainAt, travel, hidden.
 */
export default function useTour({ repoId, explore, nodes, edges, frame, keysEnabled }) {
  const reduced = useReducedMotion();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null); // { message, limited } after a failed start
  const [stops, setStops] = useState([]);
  const [index, setIndex] = useState(0);
  const [maxIndex, setMaxIndex] = useState(0);
  const [trainAt, setTrainAt] = useState(null); // node id the train is parked at
  const [travel, setTravel] = useState(null); // { d, reverse, duration, nodeId } while the train is on a track
  const [hidden, setHidden] = useState(false); // train faded out between stations that have no direct track

  const timers = useRef([]);
  const requestId = useRef(0);
  const later = (ms, fn) => timers.current.push(setTimeout(fn, ms));

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  // Drops everything the tour owns: timers, the pending request, the train, the stamps
  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    requestId.current++;
    setStatus("idle");
    setStops([]);
    setIndex(0);
    setMaxIndex(0);
    setTrainAt(null);
    setTravel(null);
    setHidden(false);
  }, []);

  // Switching repos, reloading the diagram or leaving the board ends the tour
  useEffect(() => reset, [repoId, nodes, reset]);

  // Camera on a station and the one after it (if any), so the next leg of the line is in view
  const moveTo = useCallback(
    (node, following, duration = 600) => frame([node, following].filter(Boolean), reduced ? 0 : duration),
    [frame, reduced],
  );

  const start = useCallback(async () => {
    if (status !== "idle") return;
    const id = ++requestId.current;
    setError(null);
    setStatus("loading");
    try {
      let list;
      try {
        list = (await (explore ? getExploreTour : getTour)(repoId)).stops;
      } catch (err) {
        // TODO: remove this branch (and utils/localTour.js) once the backend tour endpoints are live
        if (err.status !== 404 && err.status !== 405) throw err;
        list = buildLocalTour(nodes);
      }
      if (id !== requestId.current) return;
      list = (list ?? []).filter((s) => nodeById.has(s.node_id));
      if (!list.length) throw new Error("Couldn't print a ticket for this line. Try again later.");

      setStops(list);
      setIndex(0);
      setMaxIndex(0);
      setTrainAt(list[0].node_id);
      setStatus("running");
      moveTo(nodeById.get(list[0].node_id), nodeById.get(list[1]?.node_id));
    } catch (err) {
      if (id !== requestId.current) return;
      setStatus("idle");
      setError({
        message: err.status ? err.message : "Couldn't print your ticket. Check your connection and try again.",
        limited: Boolean(err.limited) || err.status === 409,
      });
    }
  }, [status, explore, repoId, nodes, nodeById, moveTo]);

  const busy = Boolean(travel) || hidden;

  const go = useCallback(
    (to) => {
      if (status !== "running" || busy || to < 0 || to >= stops.length || to === index) return;
      const prev = nodeById.get(stops[index].node_id);
      const next = nodeById.get(stops[to].node_id);
      const following = nodeById.get(stops[to + 1]?.node_id);
      setIndex(to);
      setMaxIndex((m) => Math.max(m, to));

      const track = reduced ? null : findTrack(edges, prev.id, next.id);
      const d = track && railPaths.get(track.edge.id);
      if (d) {
        // Direct track: the train runs along it. The camera holds both ends so the train is in view the whole way,
        // then settles on the new stop and the one after it (see arrive)
        const distance = Math.hypot(next.position.x - prev.position.x, next.position.y - prev.position.y);
        const duration = Math.min(2600, Math.max(1200, distance * 2.2));
        setTravel({ d, reverse: track.reverse, duration, nodeId: next.id });
        frame([prev, next], duration);
      } else if (reduced) {
        setTrainAt(next.id);
        moveTo(next, following);
      } else {
        setHidden(true);
        later(FADE_MS, () => setTrainAt(next.id));
        later(FADE_MS + REAPPEAR_MS, () => setHidden(false));
        moveTo(next, following);
      }
    },
    [status, busy, stops, index, nodeById, edges, reduced, frame, moveTo],
  );

  // The train reached the end of its track
  const arrive = useCallback(() => {
    if (!travel) return;
    setTravel(null);
    setTrainAt(travel.nodeId);
    const node = nodeById.get(travel.nodeId);
    if (node) moveTo(node, nodeById.get(stops[index + 1]?.node_id), 500);
  }, [travel, nodeById, stops, index, moveTo]);

  const next = useCallback(() => go(index + 1), [go, index]);
  const back = useCallback(() => go(index - 1), [go, index]);

  // Arrow keys step, Esc ends (ignored while typing)
  useEffect(() => {
    if (status !== "running" || !keysEnabled) return;
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, [contenteditable=true]")) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === "Escape") reset();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, keysEnabled, next, back, reset]);

  const visited = useMemo(
    () => new Set(stops.filter((_, i) => i <= maxIndex && i !== index).map((s) => s.node_id)),
    [stops, maxIndex, index],
  );

  return {
    status, error, stops, index, visited, trainAt, travel, hidden, busy, reduced,
    current: status === "running" ? stops[index] : null,
    start, next, back, go, end: reset, arrive,
    clearError: () => setError(null),
  };
}
