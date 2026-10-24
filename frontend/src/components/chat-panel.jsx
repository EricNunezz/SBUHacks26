import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Placeholder AI chat panel shown to the right of the diagram.
export default function ChatPanel({ onClose }) {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">AI Chat</h2>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex-1 p-4 text-sm text-muted-foreground">Chat coming soon.</div>
    </aside>
  );
}
