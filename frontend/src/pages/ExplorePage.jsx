import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, TrainFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TrainLoader from "@/components/TrainLoader";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MiniMap from "@/components/MiniMap";
import AddRepoProgress from "@/pages/AddRepoProgress.jsx";
import { useAuth } from "@/context/AuthContext";
import { getCatalog, mapCatalogEntry } from "@/api/client";

const LAZY_ABOVE = 100; // with this many tickets or more, sections only render their cards once scrolled near
const CARD_HEIGHT = 360; // rough height used to size a not-yet-rendered section
const CREDIT_URL = "https://github.com/MunGell/awesome-for-beginners";

// "C#" -> "c-sharp", "C++" -> "c-plus-plus": stable, unique anchor ids for the language chips
const slug = (s) => s.toLowerCase().replace(/\+/g, "-plus").replace(/#/g, "-sharp").replace(/[^a-z0-9]+/g, "-");

// Their beginner label as a link to that repo's open issues with that label
const issuesUrl = (e) =>
  `https://github.com/${e.owner}/${e.repo}/issues?q=${encodeURIComponent(`is:issue is:open label:"${e.label}"`)}`;

// NEARBY TRAINS: the beginner catalog from /api/catalog, one platform (section) per language
export default function ExplorePage({ onMapped, onSignUp }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState({ status: "loading", groups: [] }); // loading | done | error
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query); // typing stays responsive while a big list re-filters
  const [mapping, setMapping] = useState(null); // catalog entry being mapped: shows the progress screen
  const [signUpFor, setSignUpFor] = useState(null); // guest tapped "Map this line"

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", groups: [] });
    getCatalog()
      .then((groups) => !cancelled && setState({ status: "done", groups }))
      .catch(() => !cancelled && setState({ status: "error", groups: [] }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Search by name / owner / description / label; sections with no matches disappear
  const groups = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return state.groups;
    return state.groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) => `${e.name} ${e.owner} ${e.repo} ${e.description ?? ""} ${e.label ?? ""}`.toLowerCase().includes(q)),
      }))
      .filter((g) => g.entries.length);
  }, [state.groups, deferredQuery]);
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  const lazy = total >= LAZY_ABOVE;

  function startMapping(entry) {
    if (!user) setSignUpFor(entry);
    else setMapping(entry);
  }

  // Mapping in progress: the same progress screen as adding a repo
  if (mapping) {
    return (
      <AddRepoProgress
        key={mapping.id}
        name={`${mapping.owner}/${mapping.repo}`}
        runAdd={async () => ({ id: (await mapCatalogEntry(mapping.id)).repo_id })}
        onComplete={async (repo) => {
          await onMapped?.(); // refresh the repo switcher
          navigate(`/repo/${repo.id}`);
        }}
        onAddDifferent={() => setMapping(null)}
        differentLabel="Back to Nearby Trains"
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky: search + jump-to-platform chips */}
      <div className="sticky top-0 z-10 border-b-[3px] border-[var(--iron)] bg-[var(--paper)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-2">
          <div className="relative w-56 shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search destinations"
              aria-label="Search repos"
              className="h-9 pl-8"
            />
          </div>
          <nav aria-label="Languages" className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 pr-2">
            {groups.map((g) => (
              <button
                key={g.language}
                type="button"
                onClick={() => document.getElementById(`lang-${slug(g.language)}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="btn-cartoon shrink-0 px-2.5 py-1 font-mono text-xs"
              >
                {g.language}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex items-center gap-4 rounded-[14px] border-[3px] border-[var(--iron)] bg-[var(--rail-green)] px-5 py-4 shadow-[5px_5px_0_var(--iron)]">
          <TrainFront className="size-8 shrink-0 text-[var(--brass-bright)]" aria-hidden />
          <div>
            <h1 className="font-mono text-2xl font-bold uppercase tracking-[0.25em] text-[var(--brass-bright)]">Nearby Trains</h1>
            <p className="text-sm text-[var(--cream)]">Beginner-friendly repos, sorted by line (language). Pick one and board.</p>
          </div>
        </div>

        {state.status === "loading" && (
          <div className="flex justify-center py-20" aria-busy>
            <TrainLoader message="PULLING INTO THE STATION…" />
          </div>
        )}
        {state.status === "error" && (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-destructive">Couldn't load the timetable.</p>
            <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </Button>
          </div>
        )}
        {state.status === "done" && total === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {state.groups.length ? "No trains match that destination" : "No trains are running yet. Check back soon."}
          </p>
        )}
        {state.status === "done" &&
          groups.map((g) => (
            <Platform key={g.language} group={g} lazy={lazy}>
              {g.entries.map((entry) => (
                <TicketCard
                  key={entry.id}
                  entry={entry}
                  onBoard={() => navigate(`/explore/${entry.repo_id}`)}
                  onMap={() => startMapping(entry)}
                />
              ))}
            </Platform>
          ))}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          <a href={CREDIT_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            List from awesome-for-beginners (CC0)
          </a>
        </p>
      </div>

      {/* Guests can browse and board mapped lines, but mapping needs an account */}
      <Dialog open={Boolean(signUpFor)} onOpenChange={(open) => !open && setSignUpFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign up to map this line</DialogTitle>
            <DialogDescription>
              Mapping {signUpFor?.owner}/{signUpFor?.repo} uses AI, so it needs a free account. Mapped lines are free to board.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => { setSignUpFor(null); onSignUp?.(); }}>Sign up or log in</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// One language: a railway-green plate header, then a grid of tickets. With a big list the grid is only rendered once
// the section scrolls within ~800px of the screen (until then it is an empty box of about the right height).
function Platform({ group, lazy, children }) {
  const ref = useRef(null);
  const [near, setNear] = useState(!lazy);

  useEffect(() => {
    if (!lazy || near) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [lazy, near]);

  const n = group.entries.length;
  return (
    <section id={`lang-${slug(group.language)}`} className="mb-10 scroll-mt-20">
      <div className="mb-4 flex items-center justify-between rounded-[10px] border-[3px] border-[var(--iron)] bg-[var(--rail-green)] px-4 py-2 shadow-[3px_3px_0_var(--iron)]">
        <h2 className="font-mono text-base font-bold uppercase tracking-[0.2em] text-[var(--cream)]">Platform: {group.language}</h2>
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--brass-bright)]">
          {n} {n === 1 ? "train" : "trains"}
        </span>
      </div>
      <div ref={ref} className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" style={near ? undefined : { minHeight: Math.ceil(n / 3) * CARD_HEIGHT }}>
        {near ? children : null}
      </div>
    </section>
  );
}

// A ticket for one repo. Mapped ones are clickable as a whole (and keyboard focusable).
function TicketCard({ entry, onBoard, onMap }) {
  const mapped = entry.mapped;
  const stations = entry.preview?.nodes.length ?? 0;
  const stop = (e) => e.stopPropagation(); // buttons / links inside the card shouldn't also trigger the card

  return (
    <article className="ticket-item">
      <div
        className={`ticket ticket-card flex flex-col gap-2 ${mapped ? "ticket-clickable" : "ticket-static"}`}
        style={{ "--stripe": mapped ? "#2E6B52" : "#8A8F98" }}
        {...(mapped && {
          role: "link",
          tabIndex: 0,
          "aria-label": `Board ${entry.name}`,
          onClick: onBoard,
          onKeyDown: (e) => {
            if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onBoard();
            }
          },
        })}
      >
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-wider">Departing to</p>
          <h3 className="truncate text-[17px] font-extrabold uppercase leading-tight" title={entry.name}>{entry.name}</h3>
          <p className="truncate font-mono text-xs text-[var(--steel-text)]">{entry.owner}/{entry.repo}</p>
        </div>

        <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug">{entry.description}</p>

        {entry.label && (
          <a
            href={issuesUrl(entry)}
            target="_blank"
            rel="noreferrer"
            onClick={stop}
            title={`See open "${entry.label}" issues on GitHub`}
            className="w-fit -rotate-2 rounded-[3px] border-2 border-[var(--signal-red)] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--signal-red)] hover:bg-[var(--signal-red)] hover:text-[var(--cream)]"
          >
            {entry.label}
          </a>
        )}

        {/* Preview: a little grass panel with the map, or a dashed placeholder */}
        {mapped ? (
          <div className="h-24 overflow-hidden rounded-md border-2 border-[var(--iron)] bg-[#5FA343]">
            <MiniMap preview={entry.preview} />
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center rounded-md border-2 border-dashed border-[var(--steel)] bg-[var(--muted)] font-mono text-xs font-bold uppercase tracking-wider text-[var(--steel-text)]">
            Not yet mapped
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--brass-deep)]">
            {mapped ? `${stations} stations` : ""}
          </span>
          {mapped ? (
            <Button size="sm" onClick={(e) => { stop(e); onBoard(); }}>
              Board this train
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onMap}>
              Map this line
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
