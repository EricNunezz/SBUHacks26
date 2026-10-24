
import dagre from "@dagrejs/dagre";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;

export function layoutDiagram(nodes, edges){
  //make the empty graph and set the direction (Top -> bottom) & spacing between nodes 
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 90});

  //tell dagre about every box and its size
  nodes.forEach((node) => {
    g.setNode(node.id, {width: NODE_WIDTH, height: NODE_HEIGHT});
  });

  //tell dagre about every connection 
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  //let dagre do the math 
  dagre.layout(g);

  //copy dagre's poositions onto our nodes 
  return nodes.map((node) => {
    const pos = g.node(node.id);
    return{ 
      ...node, 
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      }
    };
  });
}