// TODO(remove once GET /api/repos/{id}/tour and /api/explore/{id}/tour are live): a tour built in the browser from
// the diagram, used by useTour.js only when the backend answers 404 / 405 for the tour endpoints.
// To remove: delete this file, then delete the `buildLocalTour` import and the `404 / 405` branch in hooks/useTour.js.
const GROUP_ORDER = ["frontend", "backend", "database", "external", "infra", "config"];
const MAX_STOPS = 6;

// Up to 6 stations (4 to 6 for any real diagram): frontend first, then backend, then database / external, one per category before a second of any
export function buildLocalTour(nodes) {
  const items = nodes.map((n, index) => ({ n, index, rank: Math.max(0, GROUP_ORDER.indexOf(n.data.category)) }));
  const groups = GROUP_ORDER.map((_, rank) => items.filter((i) => i.rank === rank)).filter((g) => g.length);

  const picked = [];
  const limit = Math.min(items.length, MAX_STOPS);
  for (let round = 0; picked.length < limit; round++) {
    for (const group of groups) {
      if (group[round] && picked.length < limit) picked.push(group[round]);
    }
  }
  return picked
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ n }) => ({
      node_id: n.id,
      title: n.data.label,
      narration: n.data.summary || `This is the ${n.data.label} station.`,
    }));
}
