import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { layoutDiagram } from "@/utils/layout";
import homeDiagram from "@/mock/homeDiagram.json";

// Muted category colors: low-alpha tints so they sit quietly on both light and dark themes
const CATEGORY_COLORS = {
  frontend: "oklch(0.65 0.1 250)",
  backend: "oklch(0.65 0.1 160)",
  database: "oklch(0.7 0.1 75)",
  external: "oklch(0.65 0.1 330)",
  infra: "oklch(0.6 0.02 260)",
};

// Mock JSON -> React Flow nodes, then lay out left-to-right
const nodes = layoutDiagram(
  homeDiagram.nodes.map((n) => ({
    id: n.id,
    position: { x: 0, y: 0 },
    data: { label: n.label },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    style: {
      background: `color-mix(in oklch, ${CATEGORY_COLORS[n.category]} 18%, transparent)`,
      border: `1px solid color-mix(in oklch, ${CATEGORY_COLORS[n.category]} 55%, transparent)`,
      color: "var(--foreground)",
      borderRadius: "var(--radius)",
      fontSize: 13,
    },
  })),
  homeDiagram.edges,
  "LR"
);

// Decorative diagram behind the home page. Own provider, own data: fully separate from the repo board.
export default function HomeBackground() {
  return (
    <ReactFlowProvider>
      <div className="absolute inset-0 opacity-50">
        <ReactFlow
          nodes={nodes}
          edges={homeDiagram.edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
