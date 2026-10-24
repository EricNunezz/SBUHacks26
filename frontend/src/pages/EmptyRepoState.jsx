import { Plus } from "lucide-react";

// In-app "/" when there are no repos: one faint plus button that opens the Add repo dialog.
export default function EmptyRepoState({ onAdd }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add a repo"
        className="group flex flex-col items-center gap-2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
      >
        <span className="flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-current">
          <Plus className="size-6" />
        </span>
        <span className="text-xs">Add a repo</span>
      </button>
    </div>
  );
}
