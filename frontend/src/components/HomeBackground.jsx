import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { layoutDiagram } from "@/utils/layout";
import homeDiagram from "@/mock/homeDiagram.json";
import { getCategoryTheme } from "@/theme/categories";
import { defaultEdgeOptions, gridProps } from "@/theme/flow";

// Mock JSON -> React Flow nodes, then lay out left-to-right
const nodes = layoutDiagram(
  homeDiagram.nodes.map((n) => {
    const { color } = getCategoryTheme(n.category);
    return {
      id: n.id,
      position: { x: 0, y: 0 },
      data: { label: n.label },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: `color-mix(in oklch, ${color} 18%, transparent)`,
        border: `1px solid color-mix(in oklch, ${color} 55%, transparent)`,
        color: "var(--foreground)",
        borderRadius: "var(--radius)",
        fontSize: 13,
      },
    };
  }),
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
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Lines} {...gridProps} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
