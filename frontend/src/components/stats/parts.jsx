import { TrainFront } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RUNNING_MAX_DAYS, IDLING_MAX_DAYS } from "@/lib/statsReadings";

export const TONES = { good: "#4E9C8F", mid: "#C9A227", bad: "#A0442C" };
export const MUTED = "#5F646C";
export const RULE = "#8A8F98";
const LANG_COLORS = ["#4A6FA5", "#B87333", "#4E9C8F", "#C9A227", "#A0442C", "#6B7280"];

export const daysAgo = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso)) / 86400000));

export function SpecRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 font-mono text-sm" style={{ borderBottom: `1px solid ${RULE}` }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const MAX_DAYS = 365;
const BANDS = [
  { label: "RUNNING", from: 0, to: RUNNING_MAX_DAYS, tone: "good" },
  { label: "IDLING", from: RUNNING_MAX_DAYS, to: IDLING_MAX_DAYS, tone: "mid" },
  { label: "COLD", from: IDLING_MAX_DAYS, to: MAX_DAYS, tone: "bad" },
];
const pct = (d) => `${(Math.min(d, MAX_DAYS) / MAX_DAYS) * 100}%`;

// Verdict as a tilted rubber stamp in its tone colour
export function Stamp({ tone, children, className = "" }) {
  return <span className={`stamp stamp-${tone ?? "plain"} ${className}`}>{children}</span>;
}

// A little track with a train marker at days-since-push (0..365). The coloured bands are the RUNNING/IDLING/COLD zones.
export function LinearGauge({ days }) {
  return (
    <div className="pt-3">
      <div className="relative pb-1 pt-5">
        <div className="absolute top-0 z-10 -translate-x-1/2" style={{ left: pct(days) }} title={`${days} days`}>
          <TrainFront className="size-5 rounded-sm border-2 border-[#2B2D31] bg-[#FBF9F5] p-px" strokeWidth={2.5} />
        </div>
        <div className="gauge-track" />
        <div className="mt-1.5 flex h-2 border-2 border-[#2B2D31]">
          {BANDS.map((b) => (
            <div key={b.label} style={{ width: `${((b.to - b.from) / MAX_DAYS) * 100}%`, backgroundColor: TONES[b.tone] }} />
          ))}
        </div>
      </div>
      <div className="relative mt-1 h-4 font-mono text-[10px]" style={{ color: MUTED }}>
        {[0, 90, 180, 270, 365].map((d, i) => (
          <span key={d} className="absolute" style={{ left: pct(d), transform: i === 0 ? "none" : i === 4 ? "translateX(-100%)" : "translateX(-50%)" }}>{d}d</span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px]" style={{ color: MUTED }}>
        {BANDS.map((b) => (
          <span key={b.label} className="flex items-center gap-1">
            <span className="inline-block size-2 border border-[#2B2D31]" style={{ backgroundColor: TONES[b.tone] }} />
            {b.label} {b.from}–{b.to}d
          </span>
        ))}
      </div>
    </div>
  );
}

// Boarding-pass row: a punched hole (passed) or an unpunched dashed circle (missing)
export function ChecklistRow({ label, ok, detail }) {
  return (
    <div className="flex items-center gap-3 py-2 font-mono text-sm" style={{ borderBottom: `2px dashed ${RULE}` }}>
      {ok ? (
        <span className="size-5 shrink-0 rounded-full border-2 border-[#2B2D31] bg-[#7BB86F]" role="img" aria-label="Passed" />
      ) : (
        <span className="size-5 shrink-0 rounded-full border-2 border-dashed border-[#A0442C]" role="img" aria-label="Missing" />
      )}
      <span className="font-bold">{label}</span>
      <span className="ml-auto text-right" style={{ color: MUTED }}>{detail}</span>
    </div>
  );
}

// Luggage tag: rounded tag with a hole and a short string (shape from .tag in index.css)
export function IssueRow({ issue, index = 0 }) {
  const age = daysAgo(issue.created_at);
  return (
    <div className="tag" style={{ transform: `rotate(${[-1, 0.8, -0.5, 1, -0.8][index % 5]}deg)` }}>
      <div className="tag-edge">
        <div className="tag-face space-y-1.5">
          <div className="flex gap-2 text-sm">
            <span className="font-mono font-bold" style={{ color: MUTED }}>#{issue.number}</span>
            <a href={issue.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2" style={{ color: "#8A4E1C" }}>
              {issue.title}
            </a>
          </div>
          {issue.labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {issue.labels.map((l) => (
                <span key={l} className="-rotate-2 border-2 border-[#A0442C] px-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#A0442C]">{l}</span>
              ))}
            </div>
          )}
          <div className="font-mono text-[11px]" style={{ color: MUTED }}>
            opened {age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"} ago`} · {issue.comments} comment{issue.comments === 1 ? "" : "s"}
          </div>
        </div>
      </div>
      <span className="tag-string" aria-hidden="true" />
    </div>
  );
}

export const langColor = (l, i) => (l.name === "Other" ? LANG_COLORS[5] : LANG_COLORS[i % 5]);

// Cargo line items: language, share, bytes
export function CargoLines({ languages, format }) {
  return (
    <div className="font-mono text-sm">
      {languages.map((l, i) => (
        <div key={l.name} className="flex items-center gap-2 py-1" style={{ borderBottom: `2px dashed ${RULE}` }}>
          <span className="inline-block size-3.5 shrink-0 border-2 border-[#2B2D31]" style={{ backgroundColor: langColor(l, i) }} />
          <span className="font-bold">{l.name}</span>
          <span className="ml-auto tabular-nums">{l.percent < 1 ? "<1" : Math.round(l.percent)}%</span>
          <span className="w-20 text-right tabular-nums" style={{ color: MUTED }}>{format(l.bytes)}</span>
        </div>
      ))}
    </div>
  );
}

export function HowWeReadThis({ children }) {
  return (
    <Popover>
      <PopoverTrigger className="font-mono text-[11px] underline underline-offset-2" style={{ color: MUTED }}>
        How we read this
      </PopoverTrigger>
      <PopoverContent align="end" className="space-y-1 text-xs">{children}</PopoverContent>
    </Popover>
  );
}
