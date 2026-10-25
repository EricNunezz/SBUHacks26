import { TrainFront } from "lucide-react";

// Persistent ticket on the board (top left): starts the tour, shows why it couldn't start
export default function TourButton({ tour }) {
  if (tour.status === "running") return null;
  const loading = tour.status === "loading";

  return (
    <div className="absolute left-3 top-3 z-10 flex max-w-[260px] flex-col items-start gap-2">
      <button
        onClick={tour.start}
        disabled={loading}
        className="btn-cartoon btn-cartoon-primary flex items-center gap-2 border-dashed px-3 py-2 text-xs font-extrabold uppercase tracking-wider"
      >
        <TrainFront className="size-4" />
        {loading ? "Printing your ticket..." : "Take the tour"}
      </button>
      {tour.error && (
        <p
          role="alert"
          className="cartoon-panel bg-[var(--cream)] px-3 py-2 text-xs"
          style={{ boxShadow: "3px 3px 0 var(--iron)", borderWidth: 2 }}
        >
          <span className="text-destructive">{tour.error.message}</span>
          {!tour.error.limited && <span className="text-muted-foreground"> Press the ticket to try again.</span>}
        </p>
      )}
    </div>
  );
}
