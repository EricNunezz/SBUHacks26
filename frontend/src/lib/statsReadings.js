export const RUNNING_MAX_DAYS = 30;
export const RUNNING_MIN_COMMITS = 10;
export const IDLING_MAX_DAYS = 180;
export const WELCOMING_MIN = 0.8;
export const WORKABLE_MIN = 0.4;
export const TOP_LANGUAGES = 5;

export function vitalSigns(stats) {
  const a = stats?.activity;
  if (!a) return null;
  const commits = `${a.commits_90d}${a.commits_90d_capped ? "+" : ""} commits in 90 days`;
  const reasons = [`Last push ${a.days_since_push} days ago`, commits];
  if (a.latest_release) reasons.push(`Latest release ${a.latest_release.tag}`);

  if (a.days_since_push <= RUNNING_MAX_DAYS && a.commits_90d >= RUNNING_MIN_COMMITS)
    return { verdict: "RUNNING", tone: "good", reasons };
  if (a.days_since_push <= IDLING_MAX_DAYS) return { verdict: "IDLING", tone: "mid", reasons };
  return { verdict: "COLD", tone: "bad", reasons };
}

export function friendliness(stats) {
  const c = stats?.community;
  const i = stats?.issues;
  const items = [];
  if (i?.good_first_count != null) {
    const n = i.good_first_count;
    items.push({ label: "Good first issues", ok: n > 0, detail: n > 0 ? `${n} open` : "None open" });
  }
  if (c) {
    const add = (label, ok) => items.push({ label, ok, detail: ok ? "Present" : "Missing" });
    add("CONTRIBUTING guide", c.has_contributing);
    add("Code of conduct", c.has_code_of_conduct);
    add("Issue templates", c.has_issue_template);
  }
  if (!items.length) return null;

  const ratio = items.filter((x) => x.ok).length / items.length;
  const [verdict, tone] =
    ratio >= WELCOMING_MIN ? ["WELCOMING", "good"] : ratio >= WORKABLE_MIN ? ["WORKABLE", "mid"] : ["ROUGH", "bad"];
  const reasons = items.filter((x) => !x.ok).map((x) => `${x.label}: ${x.detail.toLowerCase()}`);
  return { verdict, tone, items, reasons };
}

export function materials(stats) {
  const langs = stats?.languages;
  if (!langs) return null;
  const entries = Object.entries(langs).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (!total) return null;

  const row = (name, bytes) => ({ name, bytes, percent: (bytes / total) * 100 });
  const top = entries.slice(0, TOP_LANGUAGES).map(([n, b]) => row(n, b));
  const rest = entries.slice(TOP_LANGUAGES).reduce((sum, [, b]) => sum + b, 0);
  return { total, languages: rest ? [...top, row("Other", rest)] : top };
}
