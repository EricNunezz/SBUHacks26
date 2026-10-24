// Shared React Flow styling (board + home background). Colors come from CSS variables in index.css.
// Pipe-style edges: rounded right-angle routing, steel stroke, a bit thicker than default.
export const defaultEdgeOptions = {
  type: "smoothstep",
  style: { stroke: "var(--steel)", strokeWidth: 2 },
};

// Props for <Background variant={BackgroundVariant.Lines}>: faint blueprint grid
export const gridProps = {
  gap: 24,
  lineWidth: 1,
  color: "var(--grid)",
};
