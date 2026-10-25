import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import { shortLabel } from "@/utils/layout";

// Where along the curve the label sits (0 = source, 1 = target). Past halfway, so it reads as "into the target".
const LABEL_T = 0.55;

// Point on the cubic bezier React Flow draws between a bottom handle and a top handle
function pointOnCurve(sx, sy, tx, ty, t) {
  const c = (ty - sy) / 2; // control offset: half the vertical distance
  const mt = 1 - t;
  const w = [mt ** 3, 3 * mt * mt * t, 3 * mt * t * t, t ** 3];
  return [
    w[0] * sx + w[1] * sx + w[2] * tx + w[3] * tx,
    w[0] * sy + w[1] * (sy + c) + w[2] * (ty - c) + w[3] * ty,
  ];
}

// Bezier edge: every edge gets its own path, and its label sits on that path near the target on a cream chip
export default function LabeledEdge({
  sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, markerEnd, style, label,
}) {
  const [path, midX, midY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });
  // The formula assumes a downward edge; for back edges keep the path's own midpoint
  const [labelX, labelY] =
    targetY > sourceY ? pointOnCurve(sourceX, sourceY, targetX, targetY, LABEL_T) : [midX, midY];

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            title={label}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className="nodrag nopan pointer-events-auto absolute whitespace-nowrap rounded border bg-[var(--cream)] px-2 py-1 font-mono text-[10px] leading-none text-muted-foreground"
          >
            {shortLabel(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
