import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Cog } from "lucide-react";
import RepoNode from "@/components/RepoNode";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { layoutDiagram, NODE_WIDTH, NODE_HEIGHT } from "@/utils/layout";
import sampleRepo from "@/mock/sampleRepo.json"; // shown to guests, who have no backend ids
import NodePanel from "@/components/NodePanel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { getRepoDiagram } from "@/api/client";
import { useChat } from "@/context/ChatContext";
import { defaultEdgeOptions, gridProps } from "@/theme/flow";

const nodeTypes = { repoNode: RepoNode };

const POLL_MS = 4000; // how often a pending repo is re-fetched
const POLL_GIVE_UP_MS = 3 * 60 * 1000; // stop polling after this long
const MAX_POLL_FAILURES = 3; // failed polls in a row before showing the error state

function Centered({ children }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function SpinnerMessage({ children }) {
  return (
    <>
      <Cog className="size-8 animate-spin" />
      <p>{children}</p>
    </>
  );
}

//the actual board that lives INSIDE the provider so it can use useReactFlow()
function Flow() {
  const { repoId } = useParams();
  const { user } = useAuth();
  const isGuest = !user;

  // fetch state: "loading" | "error" | "done", plus the diagram that was fetched.
  // `forId` records which repo the state belongs to, so a stale state is never shown for a new repo.
  const [fetched, setFetched] = useState({ forId: null, state: "loading", diagram: null });
  const [reloadKey, setReloadKey] = useState(0); // bump to re-fetch (Retry / Refresh)
  const [pollKey, setPollKey] = useState(0); // bump to restart polling (Try again)
  const [timedOut, setTimedOut] = useState(false); // polled for 3 minutes and it's still pending
  const [selectedNode, setSelectedNode] = useState(null);
  const { setCenter, fitView } = useReactFlow();
  const { isOpen: chatOpen, isCollapsed: chatCollapsed, setDiagram } = useChat();

  // load the diagram whenever the repo changes (logged-in users only)
  useEffect(() => {
    setSelectedNode(null);
    setTimedOut(false);
    if (isGuest) return;
    let cancelled = false;
    setFetched({ forId: repoId, state: "loading", diagram: null });
    getRepoDiagram(repoId)
      .then((diagram) => {
        if (!cancelled) setFetched({ forId: repoId, state: "done", diagram });
      })
      .catch(() => {
        if (!cancelled) setFetched({ forId: repoId, state: "error", diagram: null });
      });
    return () => {
      cancelled = true; // a newer request (or unmount) wins over this one
    };
  }, [repoId, isGuest, reloadKey]);

  // Poll while this repo is pending (never for guests or ready repos).
  // `pending` is a boolean, so the effect only restarts when polling should start or stop,
  // not each time a poll returns another "pending" diagram.
  const pending =
    !isGuest && fetched.forId === repoId && fetched.state === "done" && fetched.diagram?.status === "pending";

  useEffect(() => {
    if (!pending) return;
    const startedAt = Date.now();
    let timer = null; // the one and only timer for this effect run
    let inFlight = false; // a request is running; its result schedules the next tick
    let failures = 0;
    let stopped = false;

    // Always clears the old timer first, so two timers can never be alive together
    const schedule = (delay = POLL_MS) => {
      clearTimeout(timer);
      timer = setTimeout(poll, delay);
    };

    async function poll() {
      if (stopped || document.visibilityState === "hidden") return; // resumes on visibilitychange
      if (Date.now() - startedAt >= POLL_GIVE_UP_MS) {
        setTimedOut(true);
        return;
      }
      inFlight = true;
      try {
        const next = await getRepoDiagram(repoId);
        if (stopped) return;
        failures = 0;
        setFetched({ forId: repoId, state: "done", diagram: next });
        if (next.status === "pending") schedule(); // ready -> `pending` flips and cleanup runs
      } catch {
        if (stopped) return;
        if (++failures >= MAX_POLL_FAILURES) {
          setFetched({ forId: repoId, state: "error", diagram: null });
        } else {
          schedule(); // keep the pending screen and try again next tick
        }
      } finally {
        inFlight = false;
      }
    }

    // Pause while the tab is hidden, check again soon after it's visible
    function onVisibility() {
      if (document.visibilityState === "hidden") clearTimeout(timer);
      else if (!inFlight) schedule(500);
    }

    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      stopped = true; // repo switch, ready, unmount, logout: ignore anything still in flight
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pending, repoId, pollKey]);

  // guests see the mock; users see the fetched data. Only "ready" diagrams have nodes to draw.
  const diagram = isGuest ? sampleRepo : fetched.diagram;
  const ready = isGuest || (fetched.state === "done" && diagram?.status === "ready");

  // convert to react flow format, then lay it out with dagre
  const { nodes, edges } = useMemo(() => {
    if (!ready) return { nodes: [], edges: [] };
    const rfNodes = diagram.nodes.map((node) => ({
      id: node.id,
      type: "repoNode",
      position: { x: 0, y: 0 },
      data: node,
    }));
    return { nodes: layoutDiagram(rfNodes, diagram.edges), edges: diagram.edges };
  }, [ready, diagram]);

  // fit the view once a new diagram has been laid out (wait a frame so the nodes are mounted)
  useEffect(() => {
    if (!nodes.length) return;
    const frame = requestAnimationFrame(() => fitView({ duration: 400 }));
    return () => cancelAnimationFrame(frame);
  }, [nodes, fitView]);

  // Select a node, open its panel, and fly the camera to it.
  // Shared by node clicks on the board and by node chips in the chat.
  const focusNode = useCallback(
    (nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setSelectedNode(node);
      setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
        zoom: 1.5,
        duration: 600,
      });
    },
    [nodes, setCenter],
  );

  // Tell the chat which nodes exist and how to focus one (cleared when the board goes away)
  useEffect(() => {
    setDiagram({ nodes: nodes.map((n) => n.data), focusNode });
    return () => setDiagram(null);
  }, [nodes, focusNode, setDiagram]);

  // The chat docks beside the board, so the board changes width. Once the panel's width
  // transition (300ms) ends, re-center on the open node or fit everything.
  const selectedRef = useRef(null);
  selectedRef.current = selectedNode;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const sel = selectedRef.current;
      if (sel) {
        setCenter(sel.position.x + NODE_WIDTH / 2, sel.position.y + NODE_HEIGHT / 2, {
          zoom: 1.5,
          duration: 300,
        });
      } else {
        fitView({ duration: 300 });
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [chatOpen, chatCollapsed, setCenter, fitView]);

  //nested function to handle clicking a node
  function handleNodeClick(event, node) {
    focusNode(node.id);
  }

  //nested function to close the panel (zoom out to everything)
  function handleClose() {
    if (!selectedNode) return;
    setSelectedNode(null);
    fitView({ duration: 600 });
  }

  // Which state to show (logged-in users); guests skip straight to the board
  if (!isGuest) {
    if (fetched.forId !== repoId || fetched.state === "loading") {
      return (
        <Centered>
          <SpinnerMessage>Loading diagram...</SpinnerMessage>
        </Centered>
      );
    }
    if (fetched.state === "error") {
      return (
        <Centered>
          <p className="text-destructive">Couldn't load this diagram.</p>
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </Centered>
      );
    }
    if (diagram.status === "pending") {
      return (
        <Centered>
          {timedOut ? (
            <>
              <p>This is taking longer than usual</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTimedOut(false);
                  setPollKey((k) => k + 1); // restarts the polling effect
                }}
              >
                Try again
              </Button>
            </>
          ) : (
            <>
              <SpinnerMessage>Mapping this repo... this can take up to a minute</SpinnerMessage>
              <p className="text-xs">This page updates automatically</p>
            </>
          )}
        </Centered>
      );
    }
  }

  return (
    <div className="relative h-full w-full animate-in fade-in duration-500">
      {isGuest && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
          Sample diagram. Sign up to map your own repos
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        onNodeClick={handleNodeClick}
        onPaneClick={handleClose}
      >
        <Background variant={BackgroundVariant.Lines} {...gridProps} />
        <Controls />
      </ReactFlow>
      {selectedNode && (
        <NodePanel
          node={selectedNode}
          nodes={nodes}
          edges={edges}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

export default function DiagramBoard() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
