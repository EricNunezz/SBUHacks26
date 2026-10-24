
import dagre from "@dagrejs/dagre";

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 76; // room for a 2-line label plus the category

// Edge labels are cut to this many characters (full text goes in a tooltip)
export const MAX_LABEL = 28;
export const shortLabel = (label = "") => (label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label);

// Returns the positioned nodes (wrapped in an object so more layout info can be added later).
export function layoutGraph(nodes, edges, direction = "TB"){
  //make the empty graph and set the direction (Top -> bottom) & spacing between nodes 
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 100, ranksep: 170});

  //tell dagre about every box and its size
  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  //tell dagre about every connection; labeled edges reserve their own space between rows
  edges.forEach((edge, i) => {
    const text = shortLabel(edge.label);
    const label = text ? { width: text.length * 7 + 20, height: 26, labelpos: "c" } : {};
    g.setEdge(edge.source, edge.target, label, edge.id ?? String(i));
  });

  //let dagre do the math 
  dagre.layout(g);

  //copy dagre's poositions onto our nodes 
  const laidOut = nodes.map((node) => {
    const pos = g.node(node.id);
    return{ 
      ...node, 
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      }
    };
  });
  return { nodes: laidOut };
}

export function layoutDiagram(nodes, edges, direction = "TB") {
  return layoutGraph(nodes, edges, direction).nodes;
}
