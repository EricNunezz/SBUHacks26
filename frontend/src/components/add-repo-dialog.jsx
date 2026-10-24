import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isValidGithubUrl } from "@/utils/github";

// Popup with a GitHub URL input. Calls onAddRepo(url) only for valid URLs.
export default function AddRepoDialog({ open, onOpenChange, onAddRepo }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault(); // don't reload the page
    const trimmed = url.trim();
    if (!isValidGithubUrl(trimmed)) {
      setError("Enter a link like https://github.com/owner/repo");
      return;
    }
    onAddRepo(trimmed);
    setUrl("");
    setError("");
    onOpenChange(false); // close the dialog
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add repo</DialogTitle>
          <DialogDescription>Paste a public GitHub repository link.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(""); // clear the error as soon as they edit
              }}
              placeholder="https://github.com/owner/repo"
              autoFocus
            />
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          </div>
          <Button type="submit" className="w-full">
            Add repo
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
