import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getRepoStats, getRepoDiagram } from "@/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useChat } from "@/context/ChatContext";
import { getCategoryTheme } from "@/theme/categories";
import { getThemeIcon } from "@/theme/icons";
import * as T from "@/lib/statsReadings";
import { vitalSigns, friendliness, materials } from "@/lib/statsReadings";
import {
  TONES, MUTED, SpecRow, LinearGauge, ChecklistRow, IssueRow, LanguageBar, HowWeReadThis,
} from "@/components/stats/parts";
const GRID = "rgba(138,143,152,0.18)";

const pageStyle = {
  backgroundColor: "#F5F2EC",
  backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
  backgroundSize: "24px 24px",
  color: "#2B2D31",
};
const cardStyle = { backgroundColor: "#FBF9F5", border: "1px solid #8A8F98" };

function formatBytes(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} KB`;
  return `${n} B`;
}

function Readout({ label, value }) {
  return (
    <div className="font-mono">
      <div className="text-[10px] uppercase tracking-widest" style={{ color: MUTED }}>{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

function ReportHeader({ owner, name, stats }) {
  const r = stats?.repo;
  const date = stats?.fetched_at ? new Date(stats.fetched_at).toISOString().slice(0, 10) : "—";
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 pb-4" style={{ borderBottom: "2px solid #B87333" }}>
      <div className="space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#B87333" }}>Inspection Report</div>
        <h1 className="font-mono text-xl font-semibold">{owner && name ? `${owner}/${name}` : "—"}</h1>
        <div className="flex flex-wrap gap-6">
          <Readout label="Stars" value={r?.stars?.toLocaleString()} />
          <Readout label="Forks" value={r?.forks?.toLocaleString()} />
          <Readout label="License" value={r?.license} />
          <Readout label="Branch" value={r?.default_branch} />
        </div>
      </div>
      <div className="px-3 py-2 font-mono text-xs tracking-widest" style={{ border: "2px solid #B87333", color: "#B87333" }}>
        INSPECTED · {date}
      </div>
    </header>
  );
}

function SectionCard({ label, verdict, tone, why, reading, question, prominent, className = "", children }) {
  const { askAbout } = useChat();
  return (
    <section
      className={`space-y-3 ${prominent ? "p-6" : "p-5"} ${className}`}
      style={prominent ? { ...cardStyle, borderTop: "3px solid #B87333" } : cardStyle}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: MUTED }}>{label}</div>
        <div className="flex gap-3">
          {reading && <HowWeReadThis>{reading}</HowWeReadThis>}
          <button type="button" onClick={() => askAbout(question)} className="font-mono text-[11px] underline underline-offset-2" style={{ color: "#B87333" }}>
            Ask the engineer
          </button>
        </div>
      </div>
      {verdict ? (
        <>
          <div className="font-mono text-3xl font-bold" style={{ color: TONES[tone] ?? "#2B2D31" }}>{verdict}</div>
          {why && <p className="text-sm" style={{ color: MUTED }}>{why}</p>}
          {children}
        </>
      ) : (
        <p className="font-mono text-sm" style={{ color: MUTED }}>No data available</p>
      )}
    </section>
  );
}

function SkeletonCard({ label, className = "" }) {
  return (
    <section className={`space-y-3 p-5 ${className}`} style={cardStyle}>
      <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: MUTED }}>{label}</div>
      <div className="font-mono text-sm" style={{ color: MUTED }}>INSPECTING…</div>
      <Skeleton className="h-4 w-3/4" style={{ backgroundColor: "#E8E3D9" }} />
      <Skeleton className="h-4 w-1/2" style={{ backgroundColor: "#E8E3D9" }} />
    </section>
  );
}

const CARDS = [
  { key: "vital", label: "01 / VITAL SIGNS" },
  { key: "friendly", label: "02 / NEWCOMER FRIENDLINESS" },
  { key: "help", label: "03 / WHERE YOU CAN HELP", className: "md:col-span-2" },
  { key: "materials", label: "04 / SIZE & MATERIALS" },
];

const pct = (x) => `${Math.round(x * 100)}%`;

function Report({ stats, diagram }) {
  const vital = vitalSigns(stats);
  const friendly = friendliness(stats);
  const mats = materials(stats);
  const act = stats.activity;
  const issues = stats.issues;
  const gfi = issues?.good_first_count;
  const counts = {};
  (diagram?.nodes ?? []).forEach((n) => (counts[n.category] = (counts[n.category] ?? 0) + 1));
  const helpQuery = encodeURIComponent('is:issue is:open label:"help wanted"');

  return (
    <>
      <SectionCard
        label="01 / VITAL SIGNS" question="Is this project still active?"
        verdict={vital?.verdict} tone={vital?.tone} why={vital?.reasons.join(" · ")}
        reading={vital && (
          <>
            <p>RUNNING: pushed within {T.RUNNING_MAX_DAYS} days and {T.RUNNING_MIN_COMMITS}+ commits in 90 days.</p>
            <p>IDLING: pushed within {T.IDLING_MAX_DAYS} days.</p>
            <p>COLD: anything older.</p>
          </>
        )}
      >
        {act && (
          <div>
            <SpecRow label="Days since push" value={act.days_since_push} />
            <SpecRow label="Commits, 90 days" value={`${act.commits_90d}${act.commits_90d_capped ? "+" : ""}`} />
            <SpecRow
              label="Latest release"
              value={act.latest_release ? `${act.latest_release.tag} · ${act.latest_release.published_at.slice(0, 10)}` : "None"}
            />
            <LinearGauge days={act.days_since_push} />
          </div>
        )}
      </SectionCard>

      <SectionCard
        label="02 / NEWCOMER FRIENDLINESS" question="Is this repo friendly to beginners?"
        verdict={friendly?.verdict} tone={friendly?.tone}
        why={friendly?.reasons.join(" · ")}
        reading={friendly && (
          <>
            <p>Checks good first issues, CONTRIBUTING, code of conduct and issue templates. Missing data is skipped.</p>
            <p>WELCOMING: {pct(T.WELCOMING_MIN)}+ of checks pass.</p>
            <p>WORKABLE: {pct(T.WORKABLE_MIN)}+ pass.</p>
            <p>ROUGH: fewer than that.</p>
          </>
        )}
      >
        {friendly?.items.map((i) => <ChecklistRow key={i.label} {...i} />)}
      </SectionCard>

      <SectionCard
        prominent className="md:col-span-2"
        label="03 / WHERE YOU CAN HELP" question="How would I make my first contribution here?"
        verdict={issues ? (gfi > 0 ? `${gfi} FOR BEGINNERS` : "NONE TAGGED") : null}
        tone={gfi > 0 ? "good" : "mid"}
        reading={<p>Open issues labeled "good first issue" (newest 5 shown) and "help wanted" on GitHub.</p>}
      >
        {issues && (
          <>
            <div className="font-mono text-sm" style={{ color: MUTED }}>
              {gfi ?? "?"} good first issues · {issues.help_wanted_count ?? "?"} help wanted
            </div>
            {issues.good_first.length ? (
              <div>{issues.good_first.map((i) => <IssueRow key={i.number} issue={i} />)}</div>
            ) : (
              <p className="text-sm">
                No issues tagged for beginners right now.{" "}
                {diagram?.url && (
                  <a href={`${diagram.url}/issues?q=${helpQuery}`} target="_blank" rel="noreferrer" className="underline" style={{ color: "#B87333" }}>
                    Browse help wanted issues
                  </a>
                )}
              </p>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard
        label="04 / SIZE & MATERIALS" question="How is this codebase organized?"
        verdict={mats ? formatBytes(mats.total) : null}
        reading={<p>Language share is by bytes of code, top {T.TOP_LANGUAGES} languages with the rest grouped as Other.</p>}
      >
        {mats && (
          <>
            <LanguageBar languages={mats.languages} />
            {stats.repo && <SpecRow label="Repo size" value={formatBytes(stats.repo.size_kb * 1000)} />}
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 font-mono text-xs">
              {Object.keys(counts).length ? (
                Object.entries(counts).map(([cat, n]) => {
                  const theme = getCategoryTheme(cat);
                  const Icon = getThemeIcon(theme);
                  return (
                    <span key={cat} className="flex items-center gap-1.5" style={{ color: theme.color }}>
                      <Icon className="size-4" /> {n} {cat}
                    </span>
                  );
                })
              ) : (
                <span style={{ color: MUTED }}>No diagram nodes yet</span>
              )}
            </div>
          </>
        )}
      </SectionCard>
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

  const current = state.forId === repoId ? state : { status: "loading", stats: null };

  return (
    <div className="h-full overflow-auto" style={pageStyle}>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {!user ? (
          <p className="py-20 text-center font-mono text-sm" style={{ color: MUTED }}>Sign up to see repo stats</p>
        ) : (
          <>
            <ReportHeader owner={repo?.id === repoId ? repo.owner : null} name={repo?.id === repoId ? repo.name : null} stats={current.stats} />
            {current.status === "error" ? (
              <div className="space-y-3 p-5" style={cardStyle}>
                <p className="font-mono text-sm" style={{ color: TONES.bad }}>Inspection failed</p>
                <Button variant="outline" size="sm" onClick={load}>Retry</Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {current.status === "loading"
                  ? CARDS.map((c) => <SkeletonCard key={c.key} label={c.label} className={c.className} />)
                  : <Report stats={current.stats} diagram={repo?.id === repoId ? repo : null} />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
