import { ReactFlow, Background, BackgroundVariant, Controls } from "@xyflow/react";

import {layoutDiagram } from "@/utils/layout";

import "@xyflow/react/dist/style.css"; 

import sampleRepo from "@/mock/sampleRepo.json"; //sample repo for testing purposes "

// Placeholder nodes/edge. Later these will come from the AI-generated diagram.

const mockNodes = sampleRepo.nodes.map((node) => ({
  id: node.id, 
  position: {x:0, y: 0 }, 
  data: node,
}))
const mockEdges = sampleRepo.edges;

const layoutedNodes = layoutDiagram(mockNodes, mockEdges);

// Full-height React Flow canvas (parent must have a height, which App.jsx gives it)
export default function DiagramBoard() {
  return (
    <div className="h-full w-full">
      <ReactFlow nodes={layoutedNodes} edges={mockEdges} fitView>
        <Background variant={BackgroundVariant.Dots} gap={16} />
        <Controls /> {/* zoom in / out / fit buttons */}
      </ReactFlow>
    </div>
  );
}
