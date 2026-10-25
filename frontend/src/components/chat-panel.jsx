import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  FileCode,
  MessageSquare,
  Trash2,
  TrainFront,
  X,
} from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { getCategoryTheme } from "@/theme/categories";
import { getThemeIcon } from "@/theme/icons";

const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 300;
const MAX_WIDTH = 520;
const RAIL_WIDTH = 48;
const WIDTH_KEY = "chatWidth";

const clampWidth = (w) => Math.min(Math.max(w, MIN_WIDTH), MAX_WIDTH);

function loadWidth() {
  try {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return saved ? clampWidth(saved) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function saveWidth(width) {
  try {
    localStorage.setItem(WIDTH_KEY, String(width));
  } catch {}
}
const fileName = (path) => path.slice(path.lastIndexOf("/") + 1);
const INPUT_MAX_HEIGHT = 138; // 6 lines of text-sm leading-5 (120) + padding (16) + border (2)

const STARTERS = [
  "Where should I start reading?",
  "Explain this repo like I'm new",
  "Which part is safest for a first contribution?",
  "What happens when a user uses this app?",
];
const FILE_STARTERS = [
  "What does this file do?",
  "Walk me through this file step by step",
  "What would I change here to add a feature?",
  "What other parts use this file?",
];
const NODE_STARTERS = [
  "What does this part do?",
  "How does it connect to the rest?",
  "Where should a beginner start here?",
  "Which file should I read first?",
];

// Docked on the right of the main area. Width animates between closed (0), rail (48) and the user's chosen width
// (drag the left border to change it). The round button on the border collapses it to the rail and back.
// blockedMessage: when set (featured repos you haven't added), the input is replaced by this text
export default function ChatPanel({ repoName, blockedMessage }) {
  const { isOpen, isCollapsed, reveal, collapse } = useChat();
  const [chatWidth, setChatWidth] = useState(loadWidth);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  // The panel is always on the board as a narrow rail; it only widens when asked (rail button, or "Ask about this")
  const showBody = isOpen && !isCollapsed;
  const width = showBody ? chatWidth : RAIL_WIDTH;

  const resizeHandle = {
    onPointerDown(e) {
      dragStart.current = { x: e.clientX, width: chatWidth };
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    },
    onPointerMove(e) {
      if (dragStart.current)
        setChatWidth(
          clampWidth(
            dragStart.current.width + (dragStart.current.x - e.clientX),
          ),
        );
    },
    onPointerUp() {
      if (!dragStart.current) return;
      dragStart.current = null;
      setDragging(false);
      saveWidth(chatWidth);
    },
  };

  return (
    // The wrapper isn't clipped, so the toggle button can sit half outside the chat's left border
    <div
      className={`relative z-10 h-full shrink-0 ${dragging ? "" : "transition-[width] duration-300 ease-in-out"}`}
      style={{ width }}
    >
      <button
        onClick={showBody ? collapse : reveal}
        className="absolute left-0 top-1/2 z-20 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--iron)] bg-[var(--cream)] text-[var(--iron)] shadow-[2px_2px_0_var(--iron)] hover:bg-[var(--brass-tint)]"
        aria-label={showBody ? "Collapse chat" : "Expand chat"}
      >
        {showBody ? (
          <ChevronRight className="size-4" />
        ) : (
          <ChevronLeft className="size-4" />
        )}
      </button>
      {showBody && (
        <div
          {...resizeHandle}
          className="absolute left-0 top-0 z-10 h-full w-1.5 -translate-x-1/2 cursor-col-resize touch-none hover:bg-[var(--copper)]/30"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat"
        />
      )}
      <aside className="relative h-full w-full overflow-hidden border-l-[3px] bg-card">
        {/* Rail: click anywhere to expand */}
        {!showBody && (
          <button
            onClick={reveal}
            className="absolute inset-0 flex items-start justify-center bg-[var(--rail-green)] pt-4 text-[var(--cream)] hover:bg-[var(--rail-green-light)]"
            aria-label="Expand chat"
          >
            <TrainFront className="size-5" />
          </button>
        )}
        {/* Body stays mounted (fixed width, hidden) so scroll position and drafts survive collapsing */}
        <div
          className={`flex h-full flex-col transition-opacity duration-200 ${showBody ? "" : "invisible opacity-0"}`}
          style={{ width: chatWidth }}
          inert={!showBody}
        >
          <ChatBody repoName={repoName} blockedMessage={blockedMessage} />
        </div>
      </aside>
    </div>
  );
}

function ChatBody({ repoName, blockedMessage }) {
  const {
    repoId,
    isOpen,
    isCollapsed,
    messages,
    attachedNode,
    attachedFile,
    detachFile,
    close,
    clearChat,
    sendMessage,
    retryMessage,
    detach,
    prefill,
    setPrefill,
  } = useChat();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const stuckRef = useRef(true); // false once the user scrolls up

  const waiting = messages.some((m) => m.status === "sending");
  const starters = attachedFile
    ? FILE_STARTERS
    : attachedNode
      ? NODE_STARTERS
      : STARTERS;

  // Smart auto-scroll: follow new messages (smoothly) unless the user scrolled up
  const shownCount = useRef(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const grew = shownCount.current > 0; // the first load of a thread jumps instead of animating
    shownCount.current = messages.length;
    if (el && stuckRef.current)
      el.scrollTo({ top: el.scrollHeight, behavior: grew ? "smooth" : "auto" });
  }, [messages, waiting]);

  // The input growing shrinks the list; keep the newest message in view instead of letting it slide under
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (stuckRef.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length); // cursor after the prefilled text
    });
  }, [prefill]);

  // Fit the input to its text whenever the value changes (typing, prefill, send) or the panel opens / expands
  useLayoutEffect(() => {
    resizeInput();
  }, [draft, isOpen, isCollapsed, user]);

  function onScroll() {
    const el = scrollRef.current;
    stuckRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  // Grow the textarea with its content (up to ~6 lines, then it scrolls). The target height is measured with
  // transitions off, then the old height is restored for a frame so the CSS height transition has something to animate.
  function resizeInput() {
    const el = inputRef.current;
    if (!el) return;
    const previous = el.offsetHeight;
    el.style.transition = "none";
    el.style.height = "auto";
    const next = Math.min(
      el.scrollHeight + (el.offsetHeight - el.clientHeight),
      INPUT_MAX_HEIGHT,
    );
    el.style.height = `${previous}px`;
    el.offsetHeight; // force a reflow so the next change animates
    el.style.transition = "";
    el.style.height = `${next}px`;
    el.style.overflowY = next >= INPUT_MAX_HEIGHT ? "auto" : "hidden";
  }

  function send(text) {
    if (waiting || !text.trim()) return;
    stuckRef.current = true; // sending always jumps to the bottom
    sendMessage(text);
    setDraft("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(draft);
    }
  }

  const AttachedIcon =
    attachedNode && getThemeIcon(getCategoryTheme(attachedNode.category));

  return (
    <>
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b-[3px] border-[var(--iron)] bg-[var(--rail-green)] px-4 text-[var(--cream)]">
        <TrainFront className="size-5 shrink-0" aria-hidden />
        <h2 className="text-sm font-bold">Ask the Conductor</h2>
        <HeaderButton
          label="Clear chat"
          onClick={clearChat}
          disabled={!messages.length}
        >
          <Trash2 className="size-4" />
        </HeaderButton>
        <HeaderButton label="Close chat" onClick={close}>
          <X className="size-4" />
        </HeaderButton>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0
          ? user &&
            !blockedMessage && (
              <div className="flex flex-col gap-2 pt-2">
                <p className="mb-1 text-xs text-muted-foreground">
                  Try asking:
                </p>
                {starters.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    disabled={waiting}
                    className="btn-cartoon px-3 py-2 text-left text-sm font-medium"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )
          : messages.map((m) => (
              <Message
                key={m.id}
                message={m}
                onRetry={() => retryMessage(m.id)}
              />
            ))}
        {waiting && <Waiting />}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t-[3px] border-[var(--iron)] p-3">
        {(attachedNode || attachedFile) && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {attachedNode && (
              <div className="flex w-fit max-w-full items-center gap-1.5 rounded border px-2 py-1 text-xs">
                <AttachedIcon
                  className="size-3.5 shrink-0"
                  style={{
                    color: getCategoryTheme(attachedNode.category).color,
                  }}
                />
                <span className="truncate">{attachedNode.label}</span>
                <button
                  onClick={detach}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Detach node"
                >
                  ✕
                </button>
              </div>
            )}
            {attachedFile && (
              <div
                className="flex w-fit max-w-full items-center gap-1.5 rounded border px-2 py-1 text-xs"
                title={attachedFile}
              >
                <FileCode className="size-3.5 shrink-0" />
                <span className="truncate font-mono">
                  {fileName(attachedFile)}
                </span>
                <button
                  onClick={detachFile}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Detach file"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}
        {blockedMessage ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            {blockedMessage}
          </p>
        ) : user ? (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              rows={1}
              placeholder="Ask about this repo..."
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              className="block h-9 min-h-9 flex-1 resize-none overflow-y-hidden rounded-lg border-2 border-[var(--iron)] bg-[var(--cream)] px-3 py-2 text-sm leading-5 outline-none transition-[height] duration-100 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/60"
            />
            <button
              onClick={() => send(draft)}
              disabled={waiting || !draft.trim()}
              className="btn-cartoon btn-cartoon-primary flex size-9 shrink-0 self-end items-center justify-center"
              aria-label="Send"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        ) : (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Sign up to chat about your repos
          </p>
        )}
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
      className="rounded p-1 text-[var(--cream)] hover:bg-[var(--rail-green-light)] disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Message({ message, onRetry }) {
  if (message.role === "assistant") {
    // Engineering-notes style: no bubble, just a thin steel rule on the left
    return (
      <div className="rounded-r-md border-l-4 border-[var(--iron)] bg-[var(--paper)] py-2 pl-3 pr-2 text-sm leading-[1.65]">
        <AiMarkdown content={message.content} />
      </div>
    );
  }

  const node = message.node;
  const NodeIcon = node && getThemeIcon(getCategoryTheme(node.category));
  return (
    <div className="flex flex-col items-end gap-1">
      {(node || message.file) && (
        <div className="flex max-w-full flex-wrap justify-end gap-1">
          {node && (
            <span
              className="flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"
              style={{ borderColor: getCategoryTheme(node.category).color }}
            >
              <NodeIcon
                className="size-3 shrink-0"
                style={{ color: getCategoryTheme(node.category).color }}
              />
              <span className="truncate">about: {node.label}</span>
            </span>
          )}
          {message.file && (
            <span
              className="flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"
              title={message.file}
            >
              <FileCode className="size-3 shrink-0" />
              <span className="truncate font-mono">
                about: {fileName(message.file)}
              </span>
            </span>
          )}
        </div>
      )}
      <div className="relative min-w-0 max-w-[85%] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg border-2 border-[var(--iron)] bg-[var(--copper-deep)] py-2 pl-3 pr-8 text-sm font-medium text-[var(--cream)] shadow-[3px_3px_0_var(--iron)] before:absolute before:inset-y-1.5 before:right-5 before:border-l-2 before:border-dashed before:border-[var(--cream)]/70 before:content-['']">
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
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
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
        <span className="font-mono text-xs tabular-nums">{seconds}s</span>
      </div>
      {seconds >= 15 && (
        <p className="text-xs">Still working, bigger questions take longer</p>
      )}
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
    p: (props) => <p className="my-3 first:mt-0 last:mb-0" {...props} />,
    ul: (props) => (
      <ul
        className="my-3 list-disc space-y-1 pl-5 first:mt-0 last:mb-0 [&_li>p]:my-0 [&_ol]:mt-1 [&_ul]:mt-1"
        {...props}
      />
    ),
    ol: (props) => (
      <ol
        className="my-3 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0 [&_li>p]:my-0 [&_ol]:mt-1 [&_ul]:mt-1"
        {...props}
      />
    ),
    h1: (props) => <h3 className="mb-1 mt-3 font-semibold" {...props} />,
    h2: (props) => <h3 className="mb-1 mt-3 font-semibold" {...props} />,
    h3: (props) => <h3 className="mb-1 mt-3 font-semibold" {...props} />,
    // Inline code and file paths; block code gets its own box via <pre>
    code: (props) => (
      <code
        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        {...props}
      />
    ),
    pre: (props) => (
      <pre
        className="my-2 overflow-x-auto rounded bg-muted p-2 text-xs [&>code]:bg-transparent [&>code]:p-0"
        {...props}
      />
    ),
    a: ({ href, children }) => {
      if (href?.startsWith("#node-")) {
        const node = nodeMap.get(decodeURIComponent(href.slice(6)));
        if (node)
          return (
            <NodeChip node={node} onClick={() => diagram.focusNode(node.id)} />
          );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <ReactMarkdown components={components}>
      {linkNodeRefs(content, nodeMap)}
    </ReactMarkdown>
  );
}

// Inline chip for a diagram node: category icon + color + label. Click flies the camera there.
function NodeChip({ node, onClick }) {
  const theme = getCategoryTheme(node.category);
  const Icon = getThemeIcon(theme);
  return (
    <button
      onClick={onClick}
      className="mx-0.5 inline-flex items-center gap-1 rounded border px-1.5 align-baseline text-[0.85em] font-medium leading-[1.35] hover:brightness-95"
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
