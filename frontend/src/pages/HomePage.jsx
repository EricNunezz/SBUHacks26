import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import HomeBackground from "@/components/HomeBackground";
import { isValidGithubUrl } from "@/utils/github";

// onLogin is only passed on the logged-out view; it shows the "Log in" link
export default function HomePage({ onAddRepo, onLogin }) {
  const [repo, setRepo] = useState(""); // just "owner/repo", the prefix is fixed
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault(); 
    const url = `https://github.com/${repo.trim()}`;
    if (!isValidGithubUrl(url)) {
      setError("Enter a repo like owner/repo");
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
        <form
          onSubmit={handleSubmit}
          noValidate
          className="pointer-events-auto w-full space-y-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
        >
          <p className="text-sm text-muted-foreground">Map the structure of a public GitHub repo.</p>
          <div className="flex gap-2">
            {/* Fixed prefix sits inside the field's border */}
            <div className="flex min-w-0 flex-1 items-center rounded-md border border-input bg-background pl-3 focus-within:ring-[3px] focus-within:ring-ring/50">
              <span className="font-mono text-sm text-muted-foreground">github.com/</span>
              <Input
                value={repo}
                onChange={(e) => {
                  setRepo(e.target.value);
                  setError(""); // clear the error as soon as they edit
                }}
                placeholder="owner/repo"
                autoFocus
                className="border-0 bg-transparent pl-0 font-mono shadow-none focus-visible:ring-0"
              />
            </div>
            <Button type="submit">Map repo</Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
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
