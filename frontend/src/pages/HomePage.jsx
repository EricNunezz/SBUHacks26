import { useState } from "react";
import { Cog } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import HomeBackground from "@/components/HomeBackground";
import { normalizeGithubUrl } from "@/utils/github";

// onLogin is only passed on the logged-out view; it shows the "Log in" link
export default function HomePage({ onAddRepo, onLogin, onExplore }) {
  const [repo, setRepo] = useState(""); // whatever the user pastes; normalized on submit
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault(); 
    const url = normalizeGithubUrl(repo);
    if (!url) {
      setError("Paste a GitHub repo link, like https://github.com/owner/repo");
      return;
    }
    onAddRepo(url);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <HomeBackground />
      <div className="relative z-10 flex h-full items-center justify-center px-4 pointer-events-none">
        {/* Card with the optional login link right below it */}
        <div className="flex w-full max-w-md flex-col items-center gap-3">
        <Cog className="size-10 text-copper" aria-label="App logo" />
        <form
          onSubmit={handleSubmit}
          noValidate
          className="pointer-events-auto w-full space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
        >
          <p className="text-sm text-muted-foreground">Map the structure of a public GitHub repo.</p>
          <div className="flex gap-2">
            <Input
              value={repo}
              onChange={(e) => {
                setRepo(e.target.value);
                setError(""); // clear the error as soon as they edit
              }}
              placeholder="https://github.com/owner/repo"
              autoFocus
              className="min-w-0 flex-1 font-mono"
            />
            <Button type="submit">Map repo</Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
        {onExplore && (
          <div className="pointer-events-auto w-full space-y-2 rounded-lg border-2 border-[var(--iron)] bg-card p-4 text-center shadow-[4px_4px_0_var(--iron)]">
            <p className="text-sm font-semibold">Don't know where to start? Board one of our featured lines</p>
            <Button type="button" variant="outline" onClick={onExplore}>
              See the timetable
            </Button>
          </div>
        )}
        {onLogin && (
          <p className="pointer-events-auto text-xs text-muted-foreground">
            Already have an account?{" "}
            <button type="button" onClick={onLogin} className="underline underline-offset-2 hover:text-foreground">
              Log in
            </button>
          </p>
        )}
        </div>
      </div>
    </div>
  );
}
