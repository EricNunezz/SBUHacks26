import { useState } from "react";
import { ChevronRight, Code, ExternalLink, MessageSquare, MoreHorizontal } from "lucide-react";
import { useChat } from "@/context/ChatContext";
import useFloatingPanel from "@/hooks/useFloatingPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { githubFileUrl } from "@/utils/github";

// repoUrl is the repo's GitHub url (https://github.com/owner/repo)
export default function NodePanel({ node, nodes, edges, repoUrl, onViewFile, onClose }) {
  const { label, summary, key_points = [], files = [] } = node.data;
  const { open: openChat, askAbout } = useChat();
  const asNode = { id: node.id, label, category: node.data.category };

  const [collapsed, setCollapsed] = useState(false);
  const { panelRef, dragProps, getStyle } = useFloatingPanel();

  const nameOf = (id) => nodes.find((n) => n.id === id)?.data.label ?? id;
  const outgoing = edges.filter((e) => e.source === node.id);
  const incoming = edges.filter((e) => e.target === node.id);

  return (
    <aside
      ref={panelRef}
      className="absolute right-4 top-4 flex max-h-[calc(100%-2rem)] w-96 flex-col rounded-xl border bg-card shadow-lg"
      style={getStyle()}
    >
      {/* Header: drag handle + buttons */}
      <div
        className="flex cursor-grab select-none items-center justify-between border-b px-5 py-3 active:cursor-grabbing"
        {...dragProps}
      >
        {/* Notion-style toggle: chevron + title collapse the panel */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex min-w-0 items-center gap-1 rounded text-left hover:bg-muted"
          aria-label={collapsed ? "Expand" : "Collapse"}
          aria-expanded={!collapsed}
        >
          <ChevronRight
            className={`size-5 shrink-0 text-muted-foreground transition-transform duration-150 ${
              collapsed ? "" : "rotate-90"
            }`}
          />
          <h2 className="truncate text-lg font-semibold">{label}</h2>
        </button>
        <button
          onClick={onClose}
          className="rounded px-2 text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Body: hidden when collapsed */}
      {!collapsed && (
        <div className="overflow-y-auto p-5">
          <button
            onClick={() => openChat(asNode)}
            className="mb-5 flex items-center gap-2 rounded-md border border-[var(--copper)] px-3 py-1.5 text-sm text-[var(--copper-deep)] hover:bg-[var(--copper)]/10"
          >
            <MessageSquare className="size-4" />
            Ask about this
          </button>

          <Section title="In plain English">
            <p className="text-sm leading-relaxed">{summary}</p>
          </Section>

          {key_points.length > 0 && (
            <Section title="Key points">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {key_points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </Section>
          )}

          {(outgoing.length > 0 || incoming.length > 0) && (
            <Section title="Connects to">
              <ul className="space-y-1 text-sm">
                {outgoing.map((e) => (
                  <li key={e.id}>→ {e.label} <b>{nameOf(e.target)}</b></li>
                ))}
                {incoming.map((e) => (
                  <li key={e.id}>← <b>{nameOf(e.source)}</b> {e.label} this</li>
                ))}
              </ul>
            </Section>
          )}

          {files.length > 0 && (
            <Section title="Main files">
              <ul className="font-mono text-xs">
                {files.map((file) => {
                  const slash = file.lastIndexOf("/");
                  return (
                    <li key={file} className="mb-1 flex items-center gap-1 rounded bg-muted px-2 py-1">
                      <button
                        type="button"
                        onClick={() => onViewFile(file)}
                        title={`View ${file}`}
                        className="min-w-0 flex-1 text-left hover:underline"
                      >
                        <div className="break-all font-medium">{file.slice(slash + 1)}</div>
                        {slash > 0 && <div className="break-all text-[10px] text-muted-foreground">{file.slice(0, slash)}</div>}
                      </button>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger
                          aria-label={`Actions for ${file}`}
                          className="shrink-0 rounded p-1 hover:bg-background"
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onViewFile(file)}>
                            <Code /> View code
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => askAbout(`What does ${file.slice(slash + 1)} do?`, asNode, file)}>
                            <MessageSquare /> Ask about this file
                          </DropdownMenuItem>
                          {repoUrl && (
                            <DropdownMenuItem asChild>
                              <a href={githubFileUrl(repoUrl, file)} target="_blank" rel="noreferrer">
                                <ExternalLink /> Open on GitHub
                              </a>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}
        </div>
      )}
    </aside>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}