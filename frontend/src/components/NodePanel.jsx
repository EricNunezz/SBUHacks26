import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, ExternalLink, MessageSquare } from "lucide-react";
import { useChat } from "@/context/ChatContext";

// repoUrl is the repo's GitHub url (https://github.com/owner/repo)
export default function NodePanel({ node, nodes, edges, repoUrl, onClose }) {
  const { label, summary, key_points = [], files = [] } = node.data;
  const { open: openChat, askAbout } = useChat();
  const asNode = { id: node.id, label, category: node.data.category };

  // Collapse + drag state
  const [collapsed, setCollapsed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef(null);
  const panelRef = useRef(null);
  const offsetRef = useRef(offset); // offset currently applied to the DOM

  // Keep the panel fully inside its parent by limiting the offset
  const clampOffset = useCallback((next) => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent) return next;
    const p = panel.getBoundingClientRect();
    const b = parent.getBoundingClientRect();
    const cur = offsetRef.current;
    // How far the panel can still move in each direction from where it is now
    const minX = cur.x + (b.left - p.left);
    const maxX = cur.x + (b.right - p.right);
    const minY = cur.y + (b.top - p.top);
    const maxY = cur.y + (b.bottom - p.bottom);
    // If the panel is bigger than the board, min > max: favor top-left
    return {
      x: Math.max(minX, Math.min(next.x, maxX)),
      y: Math.max(minY, Math.min(next.y, maxY)),
    };
  }, []);

  function applyOffset(next) {
    const clamped = clampOffset(next);
    if (clamped.x === offsetRef.current.x && clamped.y === offsetRef.current.y) return;
    offsetRef.current = clamped;
    setOffset(clamped);
  }

  // Re-clamp when the panel or board changes size (collapse/expand, window resize)
  useEffect(() => {
    const panel = panelRef.current;
    const reclamp = () => applyOffset(offsetRef.current);
    const ro = new ResizeObserver(reclamp);
    ro.observe(panel);
    ro.observe(panel.parentElement);
    window.addEventListener("resize", reclamp);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", reclamp);
    };
  }, []);

  // Mouse/finger goes down on the header: remember where we started
  function startDrag(e) {
    if (e.target.closest("button")) return; // clicking a button shouldn't drag
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: offset.x,
      startY: offset.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  // Moving: new offset = where we started + how far the mouse moved (clamped)
  function onDrag(e) {
    if (!dragStart.current) return;
    applyOffset({
      x: dragStart.current.startX + (e.clientX - dragStart.current.mouseX),
      y: dragStart.current.startY + (e.clientY - dragStart.current.mouseY),
    });
  }

  // Let go: stop dragging
  function endDrag() {
    dragStart.current = null;
  }

  const nameOf = (id) => nodes.find((n) => n.id === id)?.data.label ?? id;
  const outgoing = edges.filter((e) => e.source === node.id);
  const incoming = edges.filter((e) => e.target === node.id);

  return (
    <aside
      ref={panelRef}
      className="absolute right-4 top-4 flex max-h-[calc(100%-2rem)] w-96 flex-col rounded-xl border bg-card shadow-lg"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      {/* Header: drag handle + buttons */}
      <div
        className="flex cursor-grab select-none items-center justify-between border-b px-5 py-3 active:cursor-grabbing"
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
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
                    <li key={file} className="group flex items-center gap-1 rounded bg-muted px-2 py-1 mb-1">
                      <div className="min-w-0 flex-1" title={file}>
                        <div className="break-all font-medium">{file.slice(slash + 1)}</div>
                        {slash > 0 && <div className="break-all text-[10px] text-muted-foreground">{file.slice(0, slash)}</div>}
                      </div>
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        {repoUrl && (
                          <a
                            href={`${repoUrl}/blob/HEAD/${file.split("/").map(encodeURIComponent).join("/")}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open on GitHub"
                            aria-label={`Open ${file} on GitHub`}
                            className="rounded p-1 hover:bg-background"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                        <button
                          title="Ask about this file"
                          aria-label={`Ask about ${file}`}
                          onClick={() => askAbout(`What does ${file} do, and how does it fit into ${label}?`, asNode)}
                          className="rounded p-1 hover:bg-background"
                        >
                          <MessageSquare className="size-3.5" />
                        </button>
                      </div>
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