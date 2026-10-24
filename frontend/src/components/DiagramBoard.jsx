import { ReactFlow, Background, BackgroundVariant, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css"; // required React Flow styles

// Placeholder nodes/edge. Later these will come from the AI-generated diagram.
const nodes = [
  { id: "1", position: { x: 100, y: 100 }, data: { label: "Node A" } },
  { id: "2", position: { x: 350, y: 200 }, data: { label: "Node B" } },
];
const edges = [{ id: "e1-2", source: "1", target: "2" }];

// Full-height React Flow canvas (parent must have a height, which App.jsx gives it)
export default function DiagramBoard() {
  return (
    <div className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background variant={BackgroundVariant.Dots} gap={16} />
        <Controls /> {/* zoom in / out / fit buttons */}
      </ReactFlow>
    </div>
  );
}
