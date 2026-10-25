import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { TrainFront } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getRepoStats, getRepoDiagram } from "@/api/client";
import { Button } from "@/components/ui/button";
import { getCategoryTheme } from "@/theme/categories";
import { getThemeIcon } from "@/theme/icons";
import * as T from "@/lib/statsReadings";
import { vitalSigns, friendliness, materials } from "@/lib/statsReadings";
import {
  MUTED, SpecRow, LinearGauge, ChecklistRow, IssueRow, CargoLines, HowWeReadThis, Stamp,
} from "@/components/stats/parts";
import { Scenery } from "@/components/stats/town";
import FreightTrain from "@/components/stats/FreightTrain";
import TrainLoader from "@/components/TrainLoader";
import { GRASS, makeTexture } from "@/components/GrassBackground";

const pageStyle = { backgroundColor: GRASS, color: "#2B2D31" };

function formatBytes(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} KB`;
  return `${n} B`;
}

const SIZE_BANDS = [["TINY", 1e6], ["SMALL", 1e7], ["MEDIUM", 1e8]]; // bytes; above the last is LARGE
const sizeVerdict = (bytes) => (SIZE_BANDS.find(([, max]) => bytes < max)?.[0] ?? "LARGE");
const pct = (x) => `${Math.round(x * 100)}%`;

// A paper on the table: slight tilt, hard shadow, optional tear-off perforation at `nx` (notches on top and bottom).
// `stub` is drawn on the left (stubSide "left") or right of the perforation.
// True on phone-sized screens, where the stubs shrink so the body keeps room
function useCompact() {
  const [compact, setCompact] = useState(() => window.matchMedia?.("(max-width: 639px)").matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 639px)");
    if (!query) return;
    const onChange = () => setCompact(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return compact;
}

function Doc({ tilt = 0, stub, stubSide = "right", stubWidth: fullStubWidth = 120, className = "", bodyClass = "", children }) {
  const compact = useCompact();
  const stubWidth = compact ? Math.min(fullStubWidth, 92) : fullStubWidth;
  const style = { "--tilt": `${tilt}deg` };
  const perf = {};
  if (stub) {
    // the perforation sits stubWidth in from the stub's outer edge (+3px on the edge layer for the iron outline)
    style["--nxe"] = `${stubSide} ${stubWidth + 3}px`;
    style["--nxf"] = `${stubSide} ${stubWidth}px`;
    perf[stubSide] = stubWidth - 1;
  }
  const stubEl = stub && <div className="doc-stub" style={{ width: stubWidth }}>{stub}</div>;
  return (
    <div className={`doc ${className}`} style={style}>
      <div className="doc-edge">
        <div className="doc-face">
          {stubSide === "left" && stubEl}
          <div className={`doc-body ${bodyClass}`}>{children}</div>
          {stubSide === "right" && stubEl}
          {stub && <span className="doc-perf" style={perf} aria-hidden="true" />}
        </div>
      </div>
    </div>
  );
}

// Label row shared by every document: section number + "How we read this"
function DocHead({ label, reading }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="doc-label">{label}</div>
      {reading && <HowWeReadThis>{reading}</HowWeReadThis>}
    </div>
  );
}

const NoData = () => <p className="mt-3 font-mono text-sm" style={{ color: MUTED }}>No data available</p>;

function Field({ label, value }) {
  return (
    <div className="font-mono">
      <div className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: MUTED }}>{label}</div>
      <div className="text-sm font-bold">{value ?? "—"}</div>
    </div>
  );
}

// Header = SEASON PASS
function ReportHeader({ owner, name, stats }) {
  const r = stats?.repo;
  const date = stats?.fetched_at ? new Date(stats.fetched_at).toISOString().slice(0, 10) : "—";
  return (
    <Doc
      tilt={-0.6}
      stubSide="left"
      stubWidth={140}
      stub={(
        <div className="pass-stub -m-3 flex h-[calc(100%+24px)] w-[calc(100%+16px)] flex-col items-center justify-center gap-2 px-2 text-center">
          <TrainFront className="size-7 text-[#E2C25A]" />
          <div className="font-mono text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#E2C25A] sm:text-sm sm:tracking-[0.2em]">GitStation</div>
        </div>
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="doc-label">Inspection Report · Holder</div>
          <h1 className="font-mono text-2xl font-extrabold leading-tight [overflow-wrap:anywhere] sm:text-3xl">
            {owner && name ? `${owner}/${name}` : "—"}
          </h1>
        </div>
        <Stamp tone="plain" className="!whitespace-normal text-center">INSPECTED · {date}</Stamp>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 border-t-2 border-dashed border-[#8A8F98] pt-3">
        <Field label="Stars" value={r?.stars?.toLocaleString()} />
        <Field label="Forks" value={r?.forks?.toLocaleString()} />
        <Field label="License" value={r?.license} />
        <Field label="Branch" value={r?.default_branch} />
      </div>
    </Doc>
  );
}

function Report({ stats, diagram }) {
  const vital = vitalSigns(stats);
  const friendly = friendliness(stats);
  const mats = materials(stats);
  const act = stats.activity;
  const issues = stats.issues;
  const counts = {};
  (diagram?.nodes ?? []).forEach((n) => (counts[n.category] = (counts[n.category] ?? 0) + 1));
  const wholeBytes = stats.repo ? stats.repo.size_kb * 1000 : null;

  return (
    <>
      <div className="grid gap-10 md:grid-cols-2">
        {/* 01 DEPARTURE TICKET */}
        <Doc
          tilt={-1}
          stubWidth={128}
          stub={vital && <Stamp tone={vital.tone} className="!px-1.5 !text-[11px] !tracking-[0.06em] sm:!px-[9px] sm:!text-[13px] sm:!tracking-[0.12em]">{vital.verdict}</Stamp>}
        >
          <DocHead
            label="01 / VITAL SIGNS"
            reading={vital && (
              <>
                <p>RUNNING: pushed within {T.RUNNING_MAX_DAYS} days and {T.RUNNING_MIN_COMMITS}+ commits in 90 days.</p>
                <p>IDLING: pushed within {T.IDLING_MAX_DAYS} days.</p>
                <p>COLD: anything older.</p>
              </>
            )}
          />
          {vital ? (
            <>
              <div className="doc-title mt-1">Last departure</div>
              {act && (
                <div className="font-mono">
                  <span className="text-4xl font-extrabold">{act.days_since_push}</span>
                  <span className="ml-2 text-sm" style={{ color: MUTED }}>days since push</span>
                </div>
              )}
              <p className="mt-1 text-sm" style={{ color: MUTED }}>{vital.reasons.join(" · ")}</p>
              {act && (
                <div className="mt-2">
                  <SpecRow label="Days since push" value={act.days_since_push} />
                  <SpecRow label="Commits, 90 days" value={`${act.commits_90d}${act.commits_90d_capped ? "+" : ""}`} />
                  <SpecRow
                    label="Latest release"
                    value={act.latest_release ? `${act.latest_release.tag} · ${act.latest_release.published_at.slice(0, 10)}` : "None"}
                  />
                  <LinearGauge days={act.days_since_push} />
                </div>
              )}
            </>
          ) : <NoData />}
        </Doc>

        {/* 02 BOARDING PASS */}
        <Doc tilt={1.2} stubWidth={92} stub={<div className="barcode" aria-hidden="true" />}>
          <DocHead
            label="02 / NEWCOMER FRIENDLINESS"
            reading={friendly && (
              <>
                <p>Checks good first issues, CONTRIBUTING, code of conduct and issue templates. Missing data is skipped.</p>
                <p>WELCOMING: {pct(T.WELCOMING_MIN)}+ of checks pass.</p>
                <p>WORKABLE: {pct(T.WORKABLE_MIN)}+ pass.</p>
                <p>ROUGH: fewer than that.</p>
              </>
            )}
          />
          {friendly ? (
            <>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <div className="doc-title">Boarding pass</div>
                <Stamp tone={friendly.tone}>{friendly.verdict}</Stamp>
              </div>
              {friendly.reasons.length > 0 && <p className="mt-1 text-sm" style={{ color: MUTED }}>{friendly.reasons.join(" · ")}</p>}
              <div className="mt-2">
                {friendly.items.map((i) => <ChecklistRow key={i.label} {...i} />)}
              </div>
            </>
          ) : <NoData />}
        </Doc>
      </div>

      {/* 03 LUGGAGE TAGS */}
      <section className="space-y-5">
        <Doc tilt={0.5}>
          <DocHead
            label="03 / WHERE YOU CAN HELP"
            reading={<p>The newest open issues on GitHub (up to 5), whatever their labels.</p>}
          />
          {issues ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="doc-title">Baggage claim: open issues</div>
                <div className="font-mono text-sm" style={{ color: MUTED }}>
                  {issues.open_count.toLocaleString()} open {issues.open_count === 1 ? "issue" : "issues"}
                </div>
              </div>
              <Stamp tone={issues.open_count > 0 ? "good" : "mid"}>
                {issues.open_count > 0 ? `${issues.open_count.toLocaleString()} OPEN` : "NONE OPEN"}
              </Stamp>
            </div>
          ) : <p className="mt-3 font-mono text-sm text-[#A0442C]">Couldn't load issues, try again later</p>}
        </Doc>
        {issues && (
          issues.items.length ? (
            <div className="grid gap-x-8 gap-y-6 px-2 sm:grid-cols-2 lg:grid-cols-3">
              {issues.items.map((i, idx) => <IssueRow key={i.number} issue={i} index={idx} />)}
            </div>
          ) : (
            <div className="mx-auto max-w-sm px-2">
              <div className="tag" style={{ transform: "rotate(1deg)" }}>
                <div className="tag-edge">
                  <div className="tag-face space-y-1 text-center">
                    <p className="font-mono text-sm font-bold">No bags to claim right now</p>
                    {diagram?.url && (
                      <a href={`${diagram.url}/issues`} target="_blank" rel="noreferrer" className="inline-block text-sm underline underline-offset-2" style={{ color: "#8A4E1C" }}>
                        Browse issues on GitHub
                      </a>
                    )}
                  </div>
                </div>
                <span className="tag-string" aria-hidden="true" />
              </div>
            </div>
          )
        )}
      </section>

      {/* 04 CARGO MANIFEST */}
      <Doc tilt={-0.5} bodyClass="manifest-lines">
        <DocHead
          label="04 / SIZE & MATERIALS"
          reading={(
            <>
              <p>Language share is by bytes of code, top {T.TOP_LANGUAGES} languages with the rest grouped as Other.</p>
              <p>TINY: under 1 MB. SMALL: under 10 MB.</p>
              <p>MEDIUM: under 100 MB. LARGE: 100 MB or more.</p>
              <p>The verdict uses the whole repo size, not just code.</p>
            </>
          )}
        />
        {mats ? (
          <div className="mt-1 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="doc-title">Freight manifest</div>
              <Stamp tone="plain">{sizeVerdict(wholeBytes ?? mats.total)}</Stamp>
            </div>
            <div className="flex flex-wrap gap-x-10 gap-y-2">
              <Field label="Code (by language)" value={formatBytes(mats.total)} />
              {wholeBytes != null && <Field label="Whole repo" value={formatBytes(wholeBytes)} />}
            </div>
            <FreightTrain languages={mats.languages} format={formatBytes} />
            <CargoLines languages={mats.languages} format={formatBytes} />
            <div>
              <div className="doc-label mb-1.5">Station counts</div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-sm">
                {Object.keys(counts).length ? (
                  Object.entries(counts).map(([cat, n]) => {
                    const theme = getCategoryTheme(cat);
                    const Icon = getThemeIcon(theme);
                    return (
                      <span key={cat} className="flex items-center gap-1.5 font-bold" style={{ color: theme.color }}>
                        <Icon className="size-4" /> {n} {cat}
                      </span>
                    );
                  })
                ) : (
                  <span style={{ color: MUTED }}>No diagram nodes yet</span>
                )}
              </div>
            </div>
          </div>
        ) : <NoData />}
      </Doc>
    </>
  );
}

export default function StatsPage() {
  const { repoId } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState({ forId: null, status: "loading", stats: null });

  const [repo, setRepo] = useState(null); // owner/name come from the diagram endpoint

  const load = useCallback(() => {
    setState({ forId: repoId, status: "loading", stats: null });
    getRepoDiagram(repoId).then(setRepo).catch(() => setRepo(null));
    getRepoStats(repoId)
      .then((stats) => setState({ forId: repoId, status: "done", stats }))
      .catch(() => setState({ forId: repoId, status: "error", stats: null }));
  }, [repoId]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Grass tile is generated once, after first paint of the flat colour (same texture as the map)
  const [grass, setGrass] = useState(null);
  useEffect(() => { setGrass(makeTexture()); }, []);

  const current = state.forId === repoId ? state : { status: "loading", stats: null };

  return (
    <div
      className="h-full overflow-auto"
      style={{ containerType: "inline-size", ...(grass ? { ...pageStyle, backgroundImage: `url(${grass})`, backgroundSize: "1024px 1024px" } : pageStyle) }}
    >
      <div className="relative min-h-full">
      <Scenery />
      <div className="relative mx-auto max-w-[1100px] space-y-10 px-6 py-10">
        {!user ? (
          <div className="mx-auto my-20 max-w-sm"><Doc><p className="text-center font-mono text-sm" style={{ color: MUTED }}>Sign up to see repo stats</p></Doc></div>
        ) : (
          <>
            <ReportHeader owner={repo?.id === repoId ? repo.owner : null} name={repo?.id === repoId ? repo.name : null} stats={current.stats} />
            {current.status === "error" ? (
              <div className="mx-auto max-w-sm">
                <Doc>
                  <p className="font-mono text-sm font-bold text-[#A0442C]">Inspection failed</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
                </Doc>
              </div>
            ) : current.status === "loading" ? (
              <div className="flex justify-center py-16" aria-busy>
                <TrainLoader message="INSPECTING THE LINE…" />
              </div>
            ) : (
              <Report stats={current.stats} diagram={repo?.id === repoId ? repo : null} />
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
