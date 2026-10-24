import { useEffect, useMemo, useState } from "react";
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
import { defaultEdgeOptions, gridProps } from "@/theme/flow";

const nodeTypes = { repoNode: RepoNode };

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
  const { setCenter, fitView } = useReactFlow();

  // load the diagram whenever the repo changes (logged-in users only)
  useEffect(() => {
    setSelectedNode(null);
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
    return { nodes: layoutDiagram(rfNodes, diagram.edges), edges: diagram.edges };
  }, [ready, diagram]);

  // fit the view once a new diagram has been laid out (wait a frame so the nodes are mounted)
  useEffect(() => {
    if (!nodes.length) return;
    const frame = requestAnimationFrame(() => fitView({ duration: 400 }));
    return () => cancelAnimationFrame(frame);
  }, [nodes, fitView]);

  //nested function to handle clicking a node
  function handleNodeClick(event, node) {
    setSelectedNode(node);
    const centerX = node.position.x + NODE_WIDTH / 2;
    const centerY = node.position.y + NODE_HEIGHT / 2;
    setCenter(centerX, centerY, { zoom: 1.5, duration: 600 });
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
          <SpinnerMessage>Mapping this repo... this can take up to a minute</SpinnerMessage>
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            Refresh
          </Button>
        </Centered>
      );
    }
  }

  return (
    <div className="relative h-full w-full">
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
