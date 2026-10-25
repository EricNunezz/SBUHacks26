// SVG path of every rail edge currently on the board, by edge id. RailEdge registers its path here so the tour
// train can follow exactly the track that is drawn. Paths are in flow coordinates.
export const railPaths = new Map();
