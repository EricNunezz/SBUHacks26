import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "@xyflow/react";
import { shortLabel } from "@/utils/layout";

// Smoothstep edge whose label sits in the gap dagre reserved for it (data.labelY), on a cream chip
export default function LabeledEdge({
  sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, markerEnd, style, label, data,
}) {
  const [path, labelX, defaultY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, centerY: data?.labelY,
  });
  const y = data?.labelY ?? defaultY;

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={style} />
      {label && (
        <EdgeLabelRenderer>
          <div
            title={label}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${y}px)` }}
            className="nodrag nopan pointer-events-auto absolute whitespace-nowrap rounded border bg-[var(--cream)] px-2 py-1 font-mono text-[10px] leading-none text-muted-foreground"
          >
            {shortLabel(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
