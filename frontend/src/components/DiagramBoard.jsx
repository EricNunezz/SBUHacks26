import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Cog } from "lucide-react";
import RepoNode from "@/components/RepoNode";
import LabeledEdge from "@/components/LabeledEdge";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  getViewportForBounds,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { layoutGraph, NODE_WIDTH, NODE_HEIGHT } from "@/utils/layout";
import sampleRepo from "@/mock/sampleRepo.json"; // shown to guests, who have no backend ids
import NodePanel from "@/components/NodePanel";
import CodeViewer from "@/components/CodeViewer";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { addMyRepo, getRepoDiagram } from "@/api/client";
import AddRepoProgress from "@/pages/AddRepoProgress.jsx";
import { useChat } from "@/context/ChatContext";
import { defaultEdgeOptions, gridProps } from "@/theme/flow";

const nodeTypes = { repoNode: RepoNode };
const edgeTypes = { labeled: LabeledEdge };

const PANEL_INSET = 416; // NodePanel: w-96 (384) + right-4 (16) + a 16px gap
const FOCUS_ZOOM = { min: 0.6, max: 1.1 };


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
  const [selectedNode, setSelectedNode] = useState(null);
  const { setViewport, fitView } = useReactFlow();
  const boardRef = useRef(null);
  const { askAbout, setDiagram } = useChat();
  const [viewing, setViewing] = useState(null); // { file, node } open in the code panel

  // load the diagram whenever the repo changes (logged-in users only)
  useEffect(() => {
    setSelectedNode(null);
    setViewing(null);
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
    const { nodes: laidOut } = layoutGraph(rfNodes, diagram.edges);
    const rfEdges = diagram.edges.map((e) => ({ ...e, type: "labeled" }));
    return { nodes: laidOut, edges: rfEdges };
  }, [ready, diagram]);

  // fit the view once a new diagram has been laid out (wait a frame so the nodes are mounted)
  useEffect(() => {
    if (!nodes.length) return;
    const frame = requestAnimationFrame(() => fitView({ duration: 400 }));
    return () => cancelAnimationFrame(frame);
  }, [nodes, fitView]);

  // Fit the node's bounds into the part of the board left of the NodePanel
  const flyTo = useCallback(
    (node, duration) => {
      const el = boardRef.current;
      if (!el) return;
      const inset = Math.min(PANEL_INSET, el.clientWidth * 0.5);
      const bounds = { x: node.position.x, y: node.position.y, width: NODE_WIDTH, height: NODE_HEIGHT };
      const view = getViewportForBounds(bounds, el.clientWidth - inset, el.clientHeight, FOCUS_ZOOM.min, FOCUS_ZOOM.max, 0.2);
      setViewport(view, { duration });
    },
    [setViewport],
  );

  // Select a node, open its panel, and fly the camera to it.
  // Shared by node clicks on the board and by node chips in the chat.
  const focusNode = useCallback(
    (nodeId) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setSelectedNode(node);
      flyTo(node, 600);
    },
    [nodes, flyTo],
  );

  // Tell the chat which nodes exist and how to focus one (cleared when the board goes away)
  useEffect(() => {
    setDiagram({ nodes: nodes.map((n) => n.data), focusNode });
    return () => setDiagram(null);
  }, [nodes, focusNode, setDiagram]);

  // The board changes width when the chat is resized / collapsed or the sidebar toggles. Once the size settles,
  // re-center on the open node or fit everything. (The floating panels re-clamp themselves, see useFloatingPanel.)
  const selectedRef = useRef(null);
  selectedRef.current = selectedNode;
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    let timer;
    let first = true; // observing fires once straight away
    const observer = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = selectedRef.current;
        if (sel) flyTo(sel, 300);
        else fitView({ duration: 300 });
      }, 150);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [ready, flyTo, fitView]);

  // Collapse the left sidebar while the code panel is open, then put it back the way the user had it
  const { open: sidebarOpen, setOpen: setSidebarOpen, isMobile } = useSidebar();
  const sidebarOpenRef = useRef(sidebarOpen);
  sidebarOpenRef.current = sidebarOpen;
  const collapsedByViewer = useRef(false);
  useEffect(() => {
    if (isMobile) return;
    if (viewing && !collapsedByViewer.current && sidebarOpenRef.current) {
      collapsedByViewer.current = true;
      setSidebarOpen(false);
    } else if (!viewing && collapsedByViewer.current) {
      collapsedByViewer.current = false;
      setSidebarOpen(true);
    }
  }, [Boolean(viewing), isMobile]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      if (collapsedByViewer.current) setSidebarOpen(true); // leaving the board (e.g. to Stats) restores it too
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

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
      // Nothing is generating this repo (e.g. its diagram was cleared), so start it here
      return (
        <AddRepoProgress
          key={`${repoId}-${reloadKey}`}
          name={`${diagram.owner}/${diagram.name}`}
          runAdd={() => addMyRepo(diagram.url)}
          onComplete={() => setReloadKey((k) => k + 1)}
        />
      );
    }
  }

  return (
    <div ref={boardRef} className="relative h-full w-full animate-in fade-in duration-500">
      {isGuest && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
          Sample diagram. Sign up to map your own repos
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
          repoUrl={diagram.url}
          onViewFile={(file) =>
            setViewing({
              file,
              node: { id: selectedNode.id, label: selectedNode.data.label, category: selectedNode.data.category },
            })
          }
          onClose={handleClose}
        />
      )}
      {viewing && (
        <CodeViewer
          file={viewing.file}
          node={viewing.node}
          repoId={repoId}
          repoUrl={diagram.url}
          onClose={() => setViewing(null)}
          onAsk={(file) =>
            askAbout(`What does ${file.slice(file.lastIndexOf("/") + 1)} do?`, viewing.node, file)
          }
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
