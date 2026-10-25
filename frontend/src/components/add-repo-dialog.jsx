import { useRef, useState } from "react";
import TrainLoader from "@/components/TrainLoader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { normalizeGithubUrl } from "@/utils/github";

// Popup with a GitHub URL input. onAddRepo(url) may return a promise (generation takes 10-30s).
// The dialog stays open while it runs, closes on success, and shows the error on failure.
export default function AddRepoDialog({ open, onOpenChange, onAddRepo }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  async function handleSubmit(e) {
    e.preventDefault(); // don't reload the page
    if (busy) return;
    const normalized = normalizeGithubUrl(url);
    if (!normalized) {
      setError("Paste a GitHub repo link, like https://github.com/owner/repo");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await onAddRepo(normalized);
      setUrl("");
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Couldn't add that repo.");
      requestAnimationFrame(() => inputRef.current?.focus()); // so Enter retries
    } finally {
      setBusy(false);
    }
  }

  // Can't be dismissed while the request runs
  function handleOpenChange(next) {
    if (busy) return;
    if (!next) setError("");
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add repo</DialogTitle>
          <DialogDescription>Paste a public GitHub repository link.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <Input
              ref={inputRef}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(""); // clear the error as soon as they edit
              }}
              placeholder="https://github.com/owner/repo"
              className="font-mono"
              disabled={busy}
              autoFocus
            />
            {error && (
              <p role="alert" className="signal-error mt-2 text-xs font-semibold text-destructive">
                <span className="signal-light" aria-hidden="true" />
                {error}
              </p>
            )}
          </div>
          {busy && (
            <div className="flex flex-col items-center gap-1 text-center text-sm text-muted-foreground">
              <TrainLoader size="sm" message="MAPPING YOUR REPO…" />
              <span>This can take up to 30 seconds</span>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            Add repo
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
