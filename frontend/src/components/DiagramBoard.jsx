import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Cog } from "lucide-react";
import RepoNode from "@/components/RepoNode";
import RailEdge from "@/components/RailEdge";
import SceneryNode from "@/components/SceneryNode";
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  getViewportForBounds,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { layoutGraph, NODE_WIDTH, NODE_HEIGHT } from "@/utils/layout";
import { routeDiagram } from "@/utils/rails";
import { placeScenery } from "@/utils/scenery";
import sampleRepo from "@/mock/sampleRepo.json"; // shown to guests, who have no backend ids
import NodePanel from "@/components/NodePanel";
import CodeViewer from "@/components/CodeViewer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { addMyRepo, getExploreRepo, getRepoDiagram } from "@/api/client";
import AddRepoProgress from "@/pages/AddRepoProgress.jsx";
import { useChat } from "@/context/ChatContext";
import { defaultEdgeOptions } from "@/theme/flow";
import GrassBackground from "@/components/GrassBackground";

const nodeTypes = { repoNode: RepoNode, scenery: SceneryNode };
const edgeTypes = { rail: RailEdge };

const PANEL_INSET = 416; // NodePanel: w-96 (384) + right-4 (16) + a 16px gap
// Fit with breathing room, but never smaller than readable; a wide diagram just overflows and can be panned
// Default view: fit the stations; never zoom out past minZoom so names stay readable
const FIT = { padding: 0.08, minZoom: 0.5, maxZoom: 1.1 };
const FOCUS_ZOOM = { min: 0.5, max: 0.8 };


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
// explore: a featured repo opened from /explore/:repoId (public, read-only). repos/onAddRepo power "Add to my repos".
function Flow({ explore = false, repos = [], onAddRepo }) {
  const { repoId } = useParams();
  const { user } = useAuth();
  const isGuest = !user && !explore; // guests on the home flow see the sample board

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
    (explore ? getExploreRepo : getRepoDiagram)(repoId)
      .then((diagram) => {
        if (!cancelled) setFetched({ forId: repoId, state: "done", diagram });
      })
      .catch(() => {
        if (!cancelled) setFetched({ forId: repoId, state: "error", diagram: null });
      });
    return () => {
      cancelled = true; // a newer request (or unmount) wins over this one
    };
  }, [repoId, isGuest, explore, reloadKey]);

  // guests see the mock; users see the fetched data. Only "ready" diagrams have nodes to draw.
  const diagram = isGuest ? sampleRepo : fetched.diagram;
  const ready = isGuest || (fetched.state === "done" && diagram?.status === "ready");

  // convert to react flow format, then lay it out with dagre
  // `nodes` are the stations; `flowNodes` adds the non-interactive scenery for React Flow to draw
  const { nodes, edges, flowNodes } = useMemo(() => {
    if (!ready) return { nodes: [], edges: [], flowNodes: [] };
    const rfNodes = diagram.nodes.map((node) => ({
      id: node.id,
      type: "repoNode",
      position: { x: 0, y: 0 },
      data: node,
    }));
    const { nodes: laidOut } = layoutGraph(rfNodes, diagram.edges);
    // give every edge its own station ports, track lane and label position
    const routed = routeDiagram(laidOut, diagram.edges);
    const scenery = placeScenery(diagram.id ?? repoId, routed.nodes, routed.tracks, routed.labelRects).map((d) => ({
      id: d.id,
      type: "scenery",
      position: { x: d.x, y: d.y },
      data: { kind: d.kind, scale: d.scale, flip: d.flip },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      deletable: false,
      zIndex: -1, // behind the stations
      style: { pointerEvents: "none" },
    }));
    return { nodes: routed.nodes, edges: routed.edges, flowNodes: [...scenery, ...routed.nodes] };
  }, [ready, diagram, repoId]);

  // Default view (and the Controls "fit view" button): frame the stations, with a little padding.
  // The zoom floor keeps text readable; a very wide diagram then overflows and can be panned.
  const fitBoard = useCallback(
    (duration) =>
      fitView({
        nodes: nodes.map((n) => ({ id: n.id })),
        padding: FIT.padding,
        minZoom: FIT.minZoom,
        maxZoom: FIT.maxZoom,
        duration,
      }),
    [nodes, fitView],
  );
  const fitStations = useCallback(() => fitBoard(400), [fitBoard]);

  // fit the view once a new diagram has been laid out (wait a frame so the nodes are mounted)
  useEffect(() => {
    if (!nodes.length) return;
    const frame = requestAnimationFrame(() => fitBoard(400));
    return () => cancelAnimationFrame(frame);
  }, [nodes, fitBoard]);

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
    setDiagram({ nodes: nodes.map(({ data: { ports, ...data } }) => data), focusNode }); // ports is render-only
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
        else fitBoard(300);
      }, 150);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [ready, flyTo, fitBoard]);

  //nested function to handle clicking a node
  function handleNodeClick(event, node) {
    focusNode(node.id);
  }

  //nested function to close the panel (zoom out to everything)
  function handleClose() {
    if (!selectedNode) return;
    setSelectedNode(null);
    fitBoard(600);
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
    if (diagram.status === "pending" && explore) {
      return (
        <Centered>
          <p>This line isn't ready yet. Check back soon.</p>
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
      {explore && (
        <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-3 rounded-lg border-2 border-[var(--iron)] bg-[var(--cream)] px-3 py-1.5 text-xs shadow-[3px_3px_0_var(--iron)]">
          <span className="font-mono font-bold uppercase tracking-wider text-[var(--brass-deep)]">Featured line</span>
          <span className="font-semibold">{diagram.owner}/{diagram.name}</span>
          {user ? (
            repos.some((r) => r.id === diagram.id) ? (
              <span className="flex items-center gap-1 font-semibold"><Check className="size-3.5" /> In your repos</span>
            ) : (
              <Button size="sm" onClick={() => onAddRepo(diagram.url)}>Add to my repos</Button>
            )
          ) : (
            <span className="text-muted-foreground">Sign up to save it</span>
          )}
        </div>
      )}
      {isGuest && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-md border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
          Sample diagram. Sign up to map your own repos
        </div>
      )}
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        minZoom={0.3}
        onNodeClick={handleNodeClick}
        onPaneClick={handleClose}
      >
        <GrassBackground />
        <Controls onFitView={fitStations} />
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
          explore={explore}
          onClose={() => setViewing(null)}
          onAsk={(file) =>
            askAbout(`What does ${file.slice(file.lastIndexOf("/") + 1)} do?`, viewing.node, file)
          }
        />
      )}
    </div>
  );
}

export default function DiagramBoard(props) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
