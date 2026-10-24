import { MarkerType } from "@xyflow/react";

// Shared React Flow styling (board + home background). Colors come from CSS variables in index.css.
// Pipe-style edges: rounded right-angle routing, steel stroke, a bit thicker than default, arrowhead at the target.
export const defaultEdgeOptions = {
  type: "smoothstep",
  style: { stroke: "var(--steel)", strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "var(--steel)" },
};

// Props for <Background variant={BackgroundVariant.Lines}>: faint blueprint grid
export const gridProps = {
  gap: 24,
  lineWidth: 1,
  color: "var(--grid)",
};
