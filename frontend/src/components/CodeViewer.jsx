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

// Steel and Steam: cream page, iron text, copper keywords, muted comments
const codeTheme = {
  plain: { color: "var(--iron)", backgroundColor: "var(--cream)" },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--steel)", fontStyle: "italic" } },
    { types: ["punctuation", "operator"], style: { color: "var(--steel-text)" } },
    { types: ["keyword", "tag", "selector", "atrule", "important"], style: { color: "var(--copper-deep)" } },
    { types: ["string", "char", "attr-value", "template-string"], style: { color: "#7A6A12" } },
    { types: ["number", "boolean", "constant", "symbol"], style: { color: "var(--rust)" } },
    { types: ["function", "class-name", "builtin", "attr-name"], style: { color: "var(--iron)", fontWeight: "600" } },
  ],
};

// Prism names for languages the API reports under other names
const PRISM_LANGUAGE = { vue: "markup", svelte: "markup", html: "markup", xml: "markup", plaintext: "text" };

// Floating panel inside the diagram board (left side, so it doesn't start under the NodePanel on the right).
// Draggable by its header, collapsible, resizable from the bottom-right corner. `file` is the path to show.
export default function CodeViewer({ file, node, repoId, repoUrl, onClose, onAsk }) {
  const [state, setState] = useState({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const { panelRef, dragProps, resizeProps, getStyle } = useFloatingPanel({ minWidth: 380 });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null });
    getRepoFile(repoId, file)
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
      className={`absolute left-4 top-4 flex w-[560px] max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border bg-[var(--cream)] shadow-lg ${
        collapsed ? "" : "h-[calc(100%-2rem)]"
      }`}
      style={getStyle(collapsed)}
    >
      {/* Header: drag handle, collapse toggle, close */}
      <div className="shrink-0 cursor-grab select-none space-y-2 border-b px-4 py-3 active:cursor-grabbing" {...dragProps}>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex min-w-0 items-center gap-1 rounded text-left hover:bg-muted"
            aria-label={collapsed ? "Expand code" : "Collapse code"}
            aria-expanded={!collapsed}
          >
            <ChevronRight
              className={`size-5 shrink-0 text-muted-foreground transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`}
            />
            <div className="min-w-0">
              <h2 className="truncate font-mono text-sm font-semibold">{name}</h2>
              {folder && <p className="truncate font-mono text-[11px] text-muted-foreground">{folder}</p>}
            </div>
          </button>
          <button onClick={onClose} className="rounded px-2 text-muted-foreground hover:bg-muted" aria-label="Close code">
            ✕
          </button>
        </div>
        {!collapsed && (
          <div className="flex flex-wrap items-center gap-2">
            {node && (
              <span
                className="flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"
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
                      <div key={i} {...getLineProps({ line })} className="flex">
                        <span className="sticky left-0 w-12 shrink-0 select-none bg-[var(--cream)] pr-3 text-right text-muted-foreground">
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
