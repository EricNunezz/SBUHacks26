import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import HomeBackground from "@/components/HomeBackground";
import { normalizeGithubUrl } from "@/utils/github";

// onLogin is only passed on the logged-out view; it shows the "Log in" link
export default function HomePage({ onAddRepo, onLogin, onExplore }) {
  const [repo, setRepo] = useState(""); // whatever the user pastes; normalized on submit
  const [error, setError] = useState("");
  const contentRef = useRef(null); // the card + its links: the backdrop keeps clear of this

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
    <div className="relative h-full w-full overflow-hidden bg-[var(--rail-green)]">
      <HomeBackground avoidRef={contentRef} />
      {/* Scrolls on short screens; the card is centred otherwise */}
      <div className="relative z-10 h-full overflow-y-auto">
        <div className="flex min-h-full flex-col items-center justify-center px-4 py-8">
          <div ref={contentRef} className="flex w-full max-w-md flex-col items-center gap-4">
          <div className="rounded-lg border-[3px] border-[var(--iron)] bg-[var(--rail-green)] px-5 py-1.5 shadow-[3px_3px_0_var(--iron)]">
            <span className="font-mono text-xl font-extrabold uppercase tracking-[0.2em] text-[var(--brass-bright)]">GitStation</span>
          </div>

          {/* The ticket booth */}
          <div className="booth-wrap w-full max-w-md">
            <form onSubmit={handleSubmit} noValidate className="booth">
              <div className="booth-header">Ticket Office</div>
              <div className="booth-body">
                <h1 className="text-balance text-2xl font-extrabold leading-tight sm:text-3xl">Every repo is a railway.</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Paste a GitHub link and we'll map its stations, tracks, and where to start.
                </p>

                <label htmlFor="destination" className="mt-6 block font-mono text-[11px] font-bold uppercase tracking-[0.2em]">
                  Destination
                </label>
                <Input
                  id="destination"
                  value={repo}
                  onChange={(e) => {
                    setRepo(e.target.value);
                    setError(""); // clear the error as soon as they edit
                  }}
                  placeholder="https://github.com/owner/repo"
                  autoFocus
                  className="mt-1.5 h-11 font-mono"
                />
                {error && <p role="alert" className="stamp-error mt-3">{error}</p>}

                <button type="submit" className="booth-btn mt-5 w-full">
                  Print my ticket
                </button>
              </div>
            </form>
          </div>

          <div className="flex flex-col items-center gap-2 text-center text-sm">
            {onLogin && (
              <p className="home-chip">
                Already have a ticket?{" "}
                <button type="button" onClick={onLogin} className="font-bold underline underline-offset-2 hover:text-[var(--copper-deep)]">
                  Log in
                </button>
              </p>
            )}
            {onExplore && (
              <p className="home-chip">
                Not sure where to go?{" "}
                <button type="button" onClick={onExplore} className="font-bold uppercase underline underline-offset-2 hover:text-[var(--copper-deep)]">
                  See Nearby Trains
                </button>
              </p>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
