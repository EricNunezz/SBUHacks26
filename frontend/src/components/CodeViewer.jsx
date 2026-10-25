import { useEffect, useState } from "react";
import { Highlight } from "prism-react-renderer";
import { ChevronRight, ExternalLink, MessageSquare } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getRepoFile } from "@/api/client";
import { getCategoryTheme } from "@/theme/categories";
import { getThemeIcon } from "@/theme/icons";
import useFloatingPanel from "@/hooks/useFloatingPanel";
import { githubFileUrl } from "@/utils/github";

// Syntax colours: one clearly different hue per kind of thing, so beginners can tell them apart at a glance.
// Every colour has at least 4.5:1 contrast on the cream page. Edit the values here.
const SYNTAX = {
  keyword: "#8A2BA8", // if, return, const, import: purple
  string: "#1E7A3E", // "text": green
  number: "#B5451B", // 42, true, null: orange
  function: "#1F5FA8", // function and method names: blue
  type: "#0B7A82", // classes and types: teal
  comment: "#667085", // notes: grey italic
  tag: "#B3261E", // HTML/JSX tags: red
  attr: "#8A5A00", // attributes: brown-gold
  property: "#1B4F8C", // object keys: dark blue
  punctuation: "#5F646C", // brackets, commas, operators: muted
};

// Shown as a legend above the code (label, colour key)
const LEGEND = [
  ["keyword", "keyword"],
  ["string", "text"],
  ["number", "number"],
  ["function", "function"],
  ["type", "class / type"],
  ["comment", "comment"],
];

const codeTheme = {
  plain: { color: "var(--iron)", backgroundColor: "var(--cream)" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: SYNTAX.comment, fontStyle: "italic" } },
    { types: ["punctuation", "operator"], style: { color: SYNTAX.punctuation } },
    { types: ["keyword", "atrule", "important", "selector"], style: { color: SYNTAX.keyword, fontWeight: "600" } },
    { types: ["string", "char", "attr-value", "template-string", "regex", "url"], style: { color: SYNTAX.string } },
    { types: ["number", "boolean", "constant", "symbol", "null"], style: { color: SYNTAX.number } },
    { types: ["function", "builtin"], style: { color: SYNTAX.function } },
    { types: ["class-name", "maybe-class-name", "namespace"], style: { color: SYNTAX.type, fontWeight: "600" } },
    { types: ["tag"], style: { color: SYNTAX.tag } },
    { types: ["attr-name"], style: { color: SYNTAX.attr } },
    { types: ["property", "parameter"], style: { color: SYNTAX.property } },
  ],
};

// Prism names for languages the API reports under other names
const PRISM_LANGUAGE = { vue: "markup", svelte: "markup", html: "markup", xml: "markup", plaintext: "text" };

// Floating panel inside the diagram board (left side, so it doesn't start under the NodePanel on the right).
// Draggable by its header, collapsible, resizable from the bottom-right corner. `file` is the path to show.
export default function CodeViewer({ file, node, repoId, repoUrl, explore = false, onClose, onAsk }) {
  const [state, setState] = useState({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const { panelRef, dragProps, resizeProps, getStyle } = useFloatingPanel({ minWidth: 380 });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null });
    getRepoFile(repoId, file, explore)
      .then((data) => !cancelled && setState({ status: "done", data }))
      .catch((err) => !cancelled && setState({ status: "error", data: null, message: err.message }));
    return () => {
      cancelled = true;
    };
  }, [file, repoId, attempt]);

  const slash = file.lastIndexOf("/");
  const name = file.slice(slash + 1);
  const folder = slash > 0 ? file.slice(0, slash) : "";
  const theme = node && getCategoryTheme(node.category);
  const NodeIcon = node && getThemeIcon(theme);

  return (
    <aside
      ref={panelRef}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className={`absolute left-4 top-4 flex w-[560px] max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] flex-col overflow-hidden bg-[var(--cream)] cartoon-panel ${
        collapsed ? "" : "h-[calc(100%-2rem)]"
      }`}
      style={getStyle(collapsed)}
    >
      {/* Header: drag handle, collapse toggle, close */}
      <div className="shrink-0 cursor-grab select-none space-y-2 border-b-[3px] border-[var(--iron)] bg-[var(--blueprint)] px-4 py-3 text-[var(--cream)] active:cursor-grabbing" {...dragProps}>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex min-w-0 items-center gap-1 rounded text-left hover:bg-white/10"
            aria-label={collapsed ? "Expand code" : "Collapse code"}
            aria-expanded={!collapsed}
          >
            <ChevronRight
              className={`size-5 shrink-0 text-[var(--cream)] transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`}
            />
            <div className="min-w-0">
              <h2 className="truncate font-mono text-sm font-semibold">{name}</h2>
              {folder && <p className="truncate font-mono text-[11px] text-[var(--cream)]/80">{folder}</p>}
            </div>
          </button>
          <button onClick={onClose} className="rounded px-2 text-[var(--cream)] hover:bg-white/10" aria-label="Close code">
            ✕
          </button>
        </div>
        {!collapsed && (
          <div className="flex flex-wrap items-center gap-2">
            {node && (
              <span
                className="flex max-w-full items-center gap-1 rounded border-2 bg-[var(--cream)] px-1.5 py-0.5 text-[11px] text-[var(--iron)]"
                style={{ borderColor: theme.color }}
              >
                <NodeIcon className="size-3 shrink-0" style={{ color: theme.color }} />
                <span className="truncate">{node.label}</span>
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => onAsk(file)}>
              <MessageSquare className="size-3.5" />
              Ask about this file
            </Button>
            {repoUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={githubFileUrl(repoUrl, file)} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open on GitHub
                </a>
              </Button>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-[var(--iron)] bg-[var(--paper)] px-4 py-1.5 font-mono text-[11px]">
            {LEGEND.map(([key, label]) => (
              <span key={key} className="flex items-center gap-1">
                <span className="size-2.5 rounded-full border border-[var(--iron)]" style={{ background: SYNTAX[key] }} />
                <span style={{ color: SYNTAX[key], fontStyle: key === "comment" ? "italic" : undefined }}>{label}</span>
              </span>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {state.status === "loading" && (
              <div className="space-y-2 p-4" aria-busy>
                {[90, 60, 75, 40, 85, 55, 70, 45].map((w, i) => (
                  <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
            {state.status === "error" && (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
                <p className="text-destructive">{state.message || "Couldn't load this file."}</p>
                <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                  Retry
                </Button>
              </div>
            )}
            {state.status === "done" && (
              <Highlight
                code={state.data.content}
                language={PRISM_LANGUAGE[state.data.language] ?? state.data.language}
                theme={codeTheme}
              >
                {({ tokens, getLineProps, getTokenProps }) => (
                  <pre className="min-w-max py-3 font-mono text-xs leading-5" style={codeTheme.plain}>
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })} className="code-line flex">
                        <span className="code-gutter sticky left-0 w-12 shrink-0 select-none border-r-2 border-[var(--copper)]/40 bg-[var(--cream)] pr-3 text-right text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="pr-4">
                          {line.map((token, j) => (
                            <span key={j} {...getTokenProps({ token })} />
                          ))}
                          {line.length === 1 && line[0].empty && "\n"}
                        </span>
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            )}
          </div>

          {state.status === "done" && state.data.truncated && (
            <p className="shrink-0 border-t px-4 py-2 text-xs text-muted-foreground">
              Showing the first {state.data.content.split("\n").length.toLocaleString()} of{" "}
              {state.data.line_count.toLocaleString()} lines.{" "}
              {repoUrl && (
                <a href={githubFileUrl(repoUrl, file)} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  See the full file on GitHub
                </a>
              )}
            </p>
          )}

          {/* Resize from the bottom-right corner */}
          <div
            {...resizeProps}
            className="absolute bottom-0 right-0 size-4 cursor-se-resize touch-none"
            aria-label="Resize code panel"
            role="separator"
          >
            <svg viewBox="0 0 16 16" className="size-4 text-muted-foreground" aria-hidden>
              <path d="M14 6 6 14M14 10l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        </>
      )}
    </aside>
  );
}
