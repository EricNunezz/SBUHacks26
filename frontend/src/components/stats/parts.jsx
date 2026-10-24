import { Check, X } from "lucide-react";
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

export function LinearGauge({ days }) {
  return (
    <div className="pt-3">
      <div className="relative h-4">
        <div className="flex h-full">
          {BANDS.map((b) => (
            <div key={b.label} style={{ width: `${((b.to - b.from) / MAX_DAYS) * 100}%`, backgroundColor: TONES[b.tone], opacity: 0.55 }} />
          ))}
        </div>
        {Array.from({ length: 13 }, (_, i) => i * 30).map((d) => (
          <div key={d} className="absolute bottom-0 h-1.5 w-px bg-[#2B2D31]" style={{ left: pct(d) }} />
        ))}
        <div className="absolute -top-2 -bottom-2 w-0.5 bg-[#2B2D31]" style={{ left: pct(days) }} title={`${days} days`} />
      </div>
      <div className="relative mt-1 h-4 font-mono text-[10px]" style={{ color: MUTED }}>
        {[0, 90, 180, 270, 365].map((d, i) => (
          <span key={d} className="absolute" style={{ left: pct(d), transform: i === 0 ? "none" : i === 4 ? "translateX(-100%)" : "translateX(-50%)" }}>{d}d</span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px]" style={{ color: MUTED }}>
        {BANDS.map((b) => (
          <span key={b.label} className="flex items-center gap-1">
            <span className="inline-block size-2" style={{ backgroundColor: TONES[b.tone] }} />
            {b.label} {b.from}–{b.to}d
          </span>
        ))}
      </div>
    </div>
  );
}

export function ChecklistRow({ label, ok, detail }) {
  const Icon = ok ? Check : X;
  return (
    <div className="flex items-center gap-2 py-1.5 font-mono text-sm" style={{ borderBottom: `1px solid ${RULE}` }}>
      <Icon className="size-4 shrink-0" style={{ color: ok ? TONES.good : TONES.bad }} />
      <span>{label}</span>
      <span className="ml-auto" style={{ color: MUTED }}>{detail}</span>
    </div>
  );
}

export function IssueRow({ issue }) {
  const age = daysAgo(issue.created_at);
  return (
    <div className="space-y-1 py-2" style={{ borderBottom: `1px solid ${RULE}` }}>
      <div className="flex gap-2 text-sm">
        <span className="font-mono" style={{ color: MUTED }}>#{issue.number}</span>
        <a href={issue.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline" style={{ color: "#B87333" }}>
          {issue.title}
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]" style={{ color: MUTED }}>
        {issue.labels.map((l) => (
          <span key={l} className="px-1.5 py-0.5" style={{ border: `1px solid ${RULE}` }}>{l}</span>
        ))}
        <span>opened {age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"} ago`}</span>
        <span>· {issue.comments} comment{issue.comments === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}

export function LanguageBar({ languages }) {
  const color = (l, i) => (l.name === "Other" ? LANG_COLORS[5] : LANG_COLORS[i % 5]);
  return (
    <div className="space-y-2">
      <div className="flex h-4 overflow-hidden" style={{ border: `1px solid ${RULE}` }}>
        {languages.map((l, i) => (
          <div key={l.name} style={{ width: `${l.percent}%`, backgroundColor: color(l, i) }} title={l.name} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
        {languages.map((l, i) => (
          <span key={l.name} className="flex items-center gap-1.5">
            <span className="inline-block size-2" style={{ backgroundColor: color(l, i) }} />
            {l.name} {l.percent < 1 ? "<1" : Math.round(l.percent)}%
          </span>
        ))}
      </div>
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
