import { TrainFront } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

// "ALL ABOARD?": offered once per repo. Esc, clicking outside and the second button all mean "explore on my own".
export default function TourInvite({ open, repoName, onTake, onDecline }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDecline()}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden bg-[var(--cream)] p-0 sm:max-w-md">
        <div className="flex items-center gap-3 bg-[var(--rail-green)] px-5 py-3 text-[var(--cream)]">
          <TrainFront className="size-6 text-[var(--brass-bright)]" />
          <DialogTitle className="text-xl font-extrabold uppercase tracking-[0.12em]">All aboard?</DialogTitle>
        </div>
        <div className="space-y-5 border-t-2 border-dashed border-[var(--iron)] px-5 py-5">
          <DialogDescription className="text-sm leading-relaxed text-[var(--iron)]">
            Take a guided tour of <strong className="font-mono">{repoName}</strong>? The conductor will walk you
            through the most important stations in order.
          </DialogDescription>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={onTake}
              className="btn-cartoon btn-cartoon-primary px-4 py-2 text-sm font-extrabold uppercase tracking-wider"
            >
              Take the tour
            </button>
            <button onClick={onDecline} className="btn-cartoon bg-[var(--brass-tint)] px-4 py-2 text-sm">
              I'll explore on my own
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
