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
      className="absolute right-4 top-4 flex max-h-[calc(100%-2rem)] w-96 flex-col overflow-hidden bg-card cartoon-panel"
      style={getStyle()}
    >
      {/* Header: drag handle + buttons */}
      <div
        className="relative flex shrink-0 cursor-grab select-none items-center justify-between border-b-[3px] border-[var(--iron)] bg-[var(--rail-green)] px-6 py-3 text-[var(--cream)] active:cursor-grabbing"
        {...dragProps}
      >
        {/* brass bolts in the corners of the header plate */}
        <span aria-hidden className="absolute left-1.5 top-1.5 size-2.5 rounded-full border-2 border-[var(--iron)] bg-[var(--brass)]" />
        <span aria-hidden className="absolute right-1.5 top-1.5 size-2.5 rounded-full border-2 border-[var(--iron)] bg-[var(--brass)]" />
        <span aria-hidden className="absolute bottom-1.5 left-1.5 size-2.5 rounded-full border-2 border-[var(--iron)] bg-[var(--brass)]" />
        <span aria-hidden className="absolute bottom-1.5 right-1.5 size-2.5 rounded-full border-2 border-[var(--iron)] bg-[var(--brass)]" />
        {/* Notion-style toggle: chevron + title collapse the panel */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex min-w-0 items-center gap-1 rounded text-left hover:bg-[var(--rail-green-light)]"
          aria-label={collapsed ? "Expand" : "Collapse"}
          aria-expanded={!collapsed}
        >
          <ChevronRight
            className={`size-5 shrink-0 text-[var(--cream)] transition-transform duration-150 ${
              collapsed ? "" : "rotate-90"
            }`}
          />
          <h2 className="truncate text-lg font-bold">{label}</h2>
        </button>
        <button
          onClick={onClose}
          className="rounded px-2 text-[var(--cream)] hover:bg-[var(--rail-green-light)]"
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
            className="btn-cartoon mb-5 flex items-center gap-2 px-3 py-1.5 text-sm"
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
                    <li key={file} className="relative mb-2 flex items-center gap-1 rounded-md border-2 border-[var(--iron)] bg-[var(--paper)] py-1 pl-7 pr-2 shadow-[2px_2px_0_var(--iron)] before:absolute before:left-2 before:top-1/2 before:size-3 before:-translate-y-1/2 before:rounded-full before:border-2 before:border-[var(--iron)] before:bg-[var(--cream)] before:content-['']">
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
                          className="shrink-0 rounded p-1 hover:bg-[var(--brass-tint)]"
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
      <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-[var(--brass-deep)]">
        {title}
      </h3>
      {children}
    </section>
  );
}