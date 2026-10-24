
import { useState } from "react";
import { 
  ReactFlow,
  ReactFlowProvider,
  Background, 
  BackgroundVariant, 
  Controls, 
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {layoutDiagram, NODE_WIDTH, NODE_HEIGHT } from "@/utils/layout";
import sampleRepo from "@/mock/sampleRepo.json"; //sample repo for testing purposes "
import NodePanel from "@/components/NodePanel";

// convert mock JSON into react flow format, then lay it out with dagre
const mockNodes = sampleRepo.nodes.map((node) => ({
  id: node.id, 
  position: {x:0, y: 0 }, 
  data: node,
}))
const mockEdges = sampleRepo.edges;
const layoutedNodes = layoutDiagram(mockNodes, mockEdges);

//the actual board that lives INSIDE the provider so it can use useReactFlow()
function Flow() { 
  const[selectedNode, setSelectedNode] = useState(null);
  const {setCenter, fitView } = useReactFlow();

  //nested function to handle clicking a node 
  function handleNodeClick(event, node){
    setSelectedNode(node);
    const centerX = node.position.x + NODE_WIDTH / 2;
    const centerY = node.position.y + NODE_HEIGHT / 2; 
    setCenter(centerX, centerY, {zoom: 1.5, duration: 600});
  }

  //nested function to close the panel (zoom out to everything)
  function handleClose(){
    if(!selectedNode) return; 
    setSelectedNode(null);
    fitView({duration: 600});
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={layoutedNodes}
        edges={mockEdges}
        fitView
        onNodeClick={handleNodeClick}
        onPaneClick={handleClose}
      >
        <Background variant={BackgroundVariant.Dots} gap={16}/>
        <Controls />
      </ReactFlow>
      {selectedNode && (
        <NodePanel
          node={selectedNode}
          nodes={layoutedNodes}
          edges={mockEdges}
          fitView
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
