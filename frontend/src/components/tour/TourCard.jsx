import { useState } from "react";
import { Check, ChevronRight, Files, MessageSquare, Play, Route } from "lucide-react";

const labelCls = "font-mono text-[11px] font-extrabold uppercase tracking-[0.16em]";
const btn = "btn-cartoon px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider";
const btnSmall = "btn-cartoon flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold";

// The route: a vertical rail with every stop as a station dot. Visited stops are stamped, the current one is brass,
// upcoming ones are muted. Clicking a stop jumps the tour there.
function RouteList({ tour }) {
  const { stops, index, visited, busy } = tour;
  return (
    <ol className="relative">
      <span aria-hidden="true" className="absolute bottom-3 left-[11px] top-3 w-[3px] bg-[var(--iron)]" />
      {stops.map((stop, i) => {
        const isCurrent = i === index;
        const isVisited = visited.has(stop.node_id);
        return (
          <li key={`${stop.node_id}-${i}`}>
            <button
              type="button"
              onClick={() => tour.go(i)}
              disabled={busy || isCurrent}
              aria-current={isCurrent ? "step" : undefined}
              className="relative flex w-full items-start gap-3 rounded-md py-1.5 text-left hover:bg-[var(--brass-tint)] disabled:hover:bg-transparent"
            >
              <span
                aria-hidden="true"
                className={`relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-[3px] border-[var(--iron)] ${
                  isCurrent ? "bg-[var(--brass)]" : isVisited ? "bg-[var(--cream)]" : "bg-[var(--paper)]"
                }`}
              >
                {isVisited && <Check className="size-3.5 text-[var(--rail-green)]" strokeWidth={4} />}
              </span>
              <span
                className={`min-w-0 break-words text-sm leading-snug ${
                  isCurrent ? "font-extrabold" : isVisited ? "font-semibold" : "text-[var(--steel-text)]"
                }`}
              >
                {stop.title}
                {isVisited && <span className="sr-only"> (visited)</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// The tour's only panel. Wide screens: docked on the right of the board as an itinerary (header, scrolling middle,
// pinned footer). Narrow screens: a bottom sheet with the current stop and a "Route" toggle.
// `node` is the current station's board node (for its summary / key points).
export default function TourCard({ tour, node, repoName, narrow, onAsk, onViewFiles }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const { stops, index, current, busy } = tour;
  if (!current) return null;
  const last = index === stops.length - 1;
  const { summary, key_points = [] } = node?.data ?? {};
  const hasDetails = Boolean(summary) || key_points.length > 0;

  const shell = narrow
    ? "absolute inset-x-2 bottom-2 max-h-[55%]"
    : "absolute bottom-4 right-4 top-4 w-[380px] max-w-[calc(100%-2rem)]";

  return (
    <section
      data-tour-card
      role="status"
      aria-live="polite"
      className={`cartoon-panel z-20 flex flex-col overflow-hidden bg-[var(--cream)] animate-in fade-in duration-300 motion-reduce:animate-none ${shell}`}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 bg-[var(--rail-green)] px-4 py-2 text-[var(--cream)]">
        <div className="min-w-0">
          <h2 className="font-mono text-sm font-extrabold uppercase tracking-[0.18em]">The Grand Tour</h2>
          {repoName && <div className="break-words font-mono text-[11px] text-[var(--brass-bright)]">{repoName}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {narrow && (
            <button
              type="button"
              onClick={() => setRouteOpen((v) => !v)}
              aria-expanded={routeOpen}
              className="btn-cartoon flex items-center gap-1 bg-[var(--brass-tint)] px-2 py-1 text-[11px] font-bold text-[var(--iron)]"
            >
              <Route className="size-3.5" />
              Route
            </button>
          )}
          <button
            type="button"
            onClick={tour.end}
            className="btn-cartoon bg-[var(--brass-tint)] px-2 py-1 text-[11px] font-bold text-[var(--iron)]"
          >
            End tour
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {(!narrow || routeOpen) && <RouteList tour={tour} />}
        <div className={`space-y-2 ${narrow && !routeOpen ? "" : "border-t-2 border-dashed border-[var(--iron)] pt-3"}`}>
          <div className={`${labelCls} text-[var(--brass-deep)]`}>
            {last ? "Last stop" : "Stop"} {index + 1} of {stops.length}
          </div>
          <h3 className="break-words text-base font-extrabold uppercase leading-tight tracking-wider">{current.title}</h3>
          <p className="text-sm leading-snug">{current.narration}</p>
          {last && (
            <p className="text-sm font-semibold text-[var(--rail-green)]">
              End of the line! Explore on your own or ask the conductor.
            </p>
          )}
          {hasDetails && (
            <div>
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                aria-expanded={detailsOpen}
                className="flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--brass-deep)] hover:underline"
              >
                <ChevronRight className={`size-3.5 transition-transform motion-reduce:transition-none ${detailsOpen ? "rotate-90" : ""}`} />
                Station details
              </button>
              {detailsOpen && (
                <div className="mt-1 space-y-1 text-sm leading-snug">
                  {summary && <p>{summary}</p>}
                  {key_points.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-5">
                      {key_points.slice(0, 3).map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t-[3px] border-[var(--iron)] bg-[var(--brass-tint)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button className={btn} onClick={tour.back} disabled={index === 0 || busy}>
            Back
          </button>
          {last ? (
            <button className={`${btn} btn-cartoon-primary`} onClick={tour.end}>
              Close
            </button>
          ) : (
            <button className={`${btn} btn-cartoon-primary`} onClick={tour.next} disabled={busy}>
              Next
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btnSmall} onClick={onAsk}>
            <MessageSquare className="size-3.5" />
            Ask the conductor
          </button>
          <button className={btnSmall} onClick={onViewFiles}>
            <Files className="size-3.5" />
            View files
          </button>
        </div>
      </div>
    </section>
  );
}

// What the panel shrinks to while the NodePanel is open
export function TourPausedPill({ onResume }) {
  return (
    <button
      type="button"
      onClick={onResume}
      className="btn-cartoon btn-cartoon-primary absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 px-4 py-2 text-xs font-extrabold uppercase tracking-wider"
    >
      <Play className="size-3.5" />
      Tour paused · Resume
    </button>
  );
}
