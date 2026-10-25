import { MessageSquare } from "lucide-react";

const labelCls = "font-mono text-[11px] font-extrabold uppercase tracking-[0.16em]";
const btn = "btn-cartoon px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider";

// The announcement card at the bottom of the board: where the train is heading and why
export default function TourCard({ tour, onAsk }) {
  const { stops, index, current, busy } = tour;
  if (!current) return null;
  const last = index === stops.length - 1;

  return (
    <section
      role="status"
      aria-live="polite"
      // Centred in the part of the board left of the NodePanel, like the camera
      style={{ left: "calc(50% - min(208px, 25%))", width: "min(520px, calc(100% - min(416px, 50%) - 2rem))" }}
      className="cartoon-panel absolute bottom-6 z-20 -translate-x-1/2 overflow-hidden bg-[var(--cream)] animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <header className="flex items-center justify-between gap-3 bg-[var(--rail-green)] px-4 py-2 text-[var(--cream)]">
        <h2 className="truncate text-sm font-extrabold uppercase tracking-wider">
          {last ? "Last stop" : "Next stop"}: {current.title}
        </h2>
        <span className={`${labelCls} shrink-0 text-[var(--brass-bright)]`}>
          Stop {index + 1} of {stops.length}
        </span>
      </header>
      <div className="space-y-2 border-t-2 border-dashed border-[var(--iron)] px-4 py-3">
        <p className="text-sm leading-snug">{current.narration}</p>
        {last && (
          <p className="text-sm font-semibold text-[var(--rail-green)]">
            End of the line! Explore on your own or ask the conductor.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button className={btn} onClick={tour.back} disabled={index === 0 || busy}>
            Back
          </button>
          {last ? (
            <>
              <button className={`${btn} btn-cartoon-primary`} onClick={tour.end}>
                Close
              </button>
              <button className={`${btn} ml-auto flex items-center gap-1.5`} onClick={onAsk}>
                <MessageSquare className="size-3.5" />
                Ask the conductor
              </button>
            </>
          ) : (
            <>
              <button className={`${btn} btn-cartoon-primary`} onClick={tour.next} disabled={busy}>
                Next
              </button>
              <button className={`${btn} ml-auto`} onClick={tour.end}>
                End tour
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
