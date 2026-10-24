import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useMatch } from "react-router-dom";
import { sendChatMessage } from "@/api/client";

const ChatContext = createContext(null);

// Shared chat state: panel open/collapsed, attached node, and one thread per repo.
// Threads live in memory only (they reset on refresh).
export function ChatProvider({ children }) {
  const repoId = useMatch("/repo/:repoId/*")?.params.repoId;

  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [attachedNode, setAttachedNode] = useState(null); // { id, label, category } or null
  const [prefill, setPrefill] = useState(null); // { text } to drop into the input; an object so repeats re-trigger
  const [threads, setThreads] = useState({}); // { [repoId]: message[] }
  // The board registers its nodes + camera here so the chat can show chips and fly to nodes
  const [diagram, setDiagram] = useState(null); // { nodes, focusNode } or null

  const threadsRef = useRef(threads);
  threadsRef.current = threads;
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;

  // A node from one repo makes no sense in another
  useEffect(() => setAttachedNode(null), [repoId]);

  const open = useCallback((node = null) => {
    setIsOpen(true);
    setIsCollapsed(false);
    setAttachedNode(node);
  }, []);
  const askAbout = useCallback((text) => {
    open();
    setPrefill({ text });
  }, [open]);
  const close = useCallback(() => setIsOpen(false), []);
  const collapse = useCallback(() => setIsCollapsed(true), []);
  const expand = useCallback(() => setIsCollapsed(false), []);
  const attach = useCallback((node) => setAttachedNode(node), []);
  const detach = useCallback(() => setAttachedNode(null), []);

  // Edit one repo's thread
  function updateThread(id, fn) {
    setThreads((all) => ({ ...all, [id]: fn(all[id] ?? []) }));
  }

  // Ask the API about message `msg` and append the reply. Used for first sends and retries.
  async function ask(id, msg) {
    const thread = threadsRef.current[id] ?? [];
    const history = thread
      .slice(0, thread.findIndex((m) => m.id === msg.id))
      .filter((m) => m.status !== "error")
      .map(({ role, content }) => ({ role, content }));
    const nodeIds = diagramRef.current?.nodes.map((n) => n.id) ?? [];

    // Marks the user message; skipped if the chat was cleared while we waited
    const setStatus = (status, reply) =>
      updateThread(id, (msgs) => {
        if (!msgs.some((m) => m.id === msg.id)) return msgs;
        const next = msgs.map((m) => (m.id === msg.id ? { ...m, status } : m));
        return reply ? [...next, reply] : next;
      });

    try {
      const { content } = await sendChatMessage(
        id,
        { message: msg.content, nodeId: msg.node?.id ?? null, history },
        nodeIds,
      );
      setStatus("sent", { id: crypto.randomUUID(), role: "assistant", content, status: "sent" });
    } catch {
      setStatus("error");
    }
  }

  const sendMessage = useCallback((text) => {
    const content = text.trim();
    if (!content || !repoId) return;
    const msg = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      node: attachedNode, // snapshot, so the chip stays even after detaching
      status: "sending",
    };
    updateThread(repoId, (msgs) => [...msgs, msg]);
    threadsRef.current = { ...threadsRef.current, [repoId]: [...(threadsRef.current[repoId] ?? []), msg] };
    ask(repoId, msg);
  }, [repoId, attachedNode]);

  const retryMessage = useCallback((msgId) => {
    const msg = (threadsRef.current[repoId] ?? []).find((m) => m.id === msgId);
    if (!msg) return;
    updateThread(repoId, (msgs) => msgs.map((m) => (m.id === msgId ? { ...m, status: "sending" } : m)));
    ask(repoId, msg);
  }, [repoId]);

  const clearChat = useCallback(() => updateThread(repoId, () => []), [repoId]);

  const messages = threads[repoId] ?? [];

  const value = useMemo(
    () => ({
      repoId, isOpen, isCollapsed, attachedNode, messages, diagram, prefill,
      open, askAbout, setPrefill, close, collapse, expand, attach, detach,
      sendMessage, retryMessage, clearChat, setDiagram,
    }),
    [repoId, isOpen, isCollapsed, attachedNode, threads, diagram, prefill, askAbout, sendMessage, retryMessage, clearChat],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}
