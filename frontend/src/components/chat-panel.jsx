import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, ChevronsRight, MessageSquare, Trash2, X } from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { getCategoryTheme } from "@/theme/categories";
import { getThemeIcon } from "@/theme/icons";

const PANEL_WIDTH = 380;
const RAIL_WIDTH = 48;

const STARTERS = [
  "Where should I start reading?",
  "Explain this repo like I'm new",
  "Which part is safest for a first contribution?",
  "What happens when a user uses this app?",
];
const NODE_STARTERS = [
  "What does this part do?",
  "How does it connect to the rest?",
  "Where should a beginner start here?",
  "Which file should I read first?",
];

// Docked on the right of the main area. Width animates between closed (0), rail (48) and full (380).
export default function ChatPanel({ repoName }) {
  const { isOpen, isCollapsed, expand } = useChat();
  const width = !isOpen ? 0 : isCollapsed ? RAIL_WIDTH : PANEL_WIDTH;
  const showBody = isOpen && !isCollapsed;

  return (
    <aside
      className="relative h-full shrink-0 overflow-hidden border-l bg-card transition-[width,border-color] duration-300 ease-in-out"
      style={{ width, borderColor: isOpen ? undefined : "transparent" }}
      aria-hidden={!isOpen}
    >
      {/* Rail: click anywhere to expand */}
      {isOpen && isCollapsed && (
        <button
          onClick={expand}
          className="absolute inset-0 flex items-start justify-center pt-4 text-muted-foreground hover:bg-muted"
          aria-label="Expand chat"
        >
          <MessageSquare className="size-5" />
        </button>
      )}
      {/* Body stays mounted (fixed width, hidden) so scroll position and drafts survive collapsing */}
      <div
        className={`flex h-full flex-col transition-opacity duration-200 ${showBody ? "" : "invisible opacity-0"}`}
        style={{ width: PANEL_WIDTH }}
        inert={!showBody}
      >
        <ChatBody repoName={repoName} />
      </div>
    </aside>
  );
}

function ChatBody({ repoName }) {
  const { repoId, messages, attachedNode, close, collapse, clearChat, sendMessage, retryMessage, detach, prefill, setPrefill } = useChat();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const stuckRef = useRef(true); // false once the user scrolls up

  const waiting = messages.some((m) => m.status === "sending");
  const starters = attachedNode ? NODE_STARTERS : STARTERS;

  // Smart auto-scroll: follow new messages unless the user scrolled up
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stuckRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, waiting]);

  // New repo, new thread: start at the bottom again
  useEffect(() => {
    stuckRef.current = true;
  }, [repoId]);

  // "Ask the engineer" links drop a question into the input without sending it
  useEffect(() => {
    if (!prefill) return;
    setDraft(prefill.text);
    setPrefill(null);
    requestAnimationFrame(() => {
      resizeInput();
      inputRef.current?.focus();
    });
  }, [prefill]);

  function onScroll() {
    const el = scrollRef.current;
    stuckRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  // Grow the textarea with its content (up to ~6 lines)
  function resizeInput() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }

  function send(text) {
    if (waiting || !text.trim()) return;
    stuckRef.current = true; // sending always jumps to the bottom
    sendMessage(text);
    setDraft("");
    requestAnimationFrame(() => {
      resizeInput();
      inputRef.current?.focus();
    });
  }



  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  }

  const AttachedIcon = attachedNode && getThemeIcon(getCategoryTheme(attachedNode.category));

  return (
    <>
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <h2 className="text-sm font-semibold">Ask the Engineer</h2>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{repoName}</span>
        <HeaderButton label="Clear chat" onClick={clearChat} disabled={!messages.length}>
          <Trash2 className="size-4" />
        </HeaderButton>
        <HeaderButton label="Collapse chat" onClick={collapse}>
          <ChevronsRight className="size-4" />
        </HeaderButton>
        <HeaderButton label="Close chat" onClick={close}>
          <X className="size-4" />
        </HeaderButton>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2 pt-2">
            <p className="mb-1 text-xs text-muted-foreground">Try asking:</p>
            {starters.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={waiting}
                className="rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {q}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m) => <Message key={m.id} message={m} onRetry={() => retryMessage(m.id)} />)
        )}
        {waiting && <Waiting />}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t p-3">
        {attachedNode && (
          <div className="mb-2 flex w-fit max-w-full items-center gap-1.5 rounded border px-2 py-1 text-xs">
            <AttachedIcon className="size-3.5 shrink-0" style={{ color: getCategoryTheme(attachedNode.category).color }} />
            <span className="truncate">{attachedNode.label}</span>
            <button onClick={detach} className="text-muted-foreground hover:text-foreground" aria-label="Detach node">
              ✕
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            placeholder="Ask about this repo..."
            onChange={(e) => {
              setDraft(e.target.value);
              resizeInput();
            }}
            onKeyDown={onKeyDown}
            className="max-h-36 min-h-9 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <button
            onClick={() => send(draft)}
            disabled={waiting || !draft.trim()}
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        {!user && <p className="mt-2 text-xs text-muted-foreground">Sign in to save this conversation</p>}
      </div>
    </>
  );
}



function HeaderButton({ label, onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Message({ message, onRetry }) {
  if (message.role === "assistant") {
    // Engineering-notes style: no bubble, just a thin steel rule on the left
    return (
      <div className="border-l-2 border-[var(--steel)] pl-3 text-sm leading-relaxed">
        <AiMarkdown content={message.content} />
      </div>
    );
  }

  const node = message.node;
  const NodeIcon = node && getThemeIcon(getCategoryTheme(node.category));
  return (
    <div className="flex flex-col items-end gap-1">
      {node && (
        <span
          className="flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"
          style={{ borderColor: getCategoryTheme(node.category).color }}
        >
          <NodeIcon className="size-3 shrink-0" style={{ color: getCategoryTheme(node.category).color }} />
          <span className="truncate">about: {node.label}</span>
        </span>
      )}
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-md bg-[var(--iron)] px-3 py-2 text-sm text-[var(--cream)]">
        {message.content}
      </div>
      {message.status === "error" && (
        <p className="text-xs text-destructive">
          Couldn't send.{" "}
          <button onClick={onRetry} className="underline underline-offset-2">
            Retry
          </button>
        </p>
      )}
    </div>
  );
}

function Waiting() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Reading the blueprints...</span>
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-pulse rounded-full bg-[var(--steel)]"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

// [[node_id]] -> markdown link "#node-<id>" when the id is in the diagram; otherwise plain id text
function linkNodeRefs(content, nodeMap) {
  return content.replace(/\[\[([^\[\]]+?)\]\]/g, (_, raw) => {
    const id = raw.trim();
    return nodeMap.has(id) ? `[node](#node-${encodeURIComponent(id)})` : id;
  });
}

function AiMarkdown({ content }) {
  const { diagram } = useChat();
  const nodeMap = new Map((diagram?.nodes ?? []).map((n) => [n.id, n]));

  const components = {
    p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
    ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
    ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
    h1: (props) => <h3 className="mb-1 mt-3 font-semibold" {...props} />,
    h2: (props) => <h3 className="mb-1 mt-3 font-semibold" {...props} />,
    h3: (props) => <h3 className="mb-1 mt-3 font-semibold" {...props} />,
    // Inline code and file paths; block code gets its own box via <pre>
    code: (props) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props} />,
    pre: (props) => (
      <pre className="my-2 overflow-x-auto rounded bg-muted p-2 text-xs [&>code]:bg-transparent [&>code]:p-0" {...props} />
    ),
    a: ({ href, children }) => {
      if (href?.startsWith("#node-")) {
        const node = nodeMap.get(decodeURIComponent(href.slice(6)));
        if (node) return <NodeChip node={node} onClick={() => diagram.focusNode(node.id)} />;
      }
      return (
        <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {children}
        </a>
      );
    },
  };

  return <ReactMarkdown components={components}>{linkNodeRefs(content, nodeMap)}</ReactMarkdown>;
}

// Inline chip for a diagram node: category icon + color + label. Click flies the camera there.
function NodeChip({ node, onClick }) {
  const theme = getCategoryTheme(node.category);
  const Icon = getThemeIcon(theme);
  return (
    <button
      onClick={onClick}
      className="mx-0.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 align-baseline text-xs font-medium hover:brightness-95"
      style={{
        borderColor: theme.color,
        backgroundColor: `color-mix(in srgb, ${theme.color} 12%, transparent)`,
      }}
    >
      <Icon className="size-3 shrink-0" style={{ color: theme.color }} />
      {node.label}
    </button>
  );
}
