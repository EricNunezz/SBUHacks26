import { BaseEdge, EdgeLabelRenderer, Position, getSmoothStepPath } from "@xyflow/react";
import { shortLabel } from "@/utils/layout";

const OUTLINE = "#2B2D31";
const WOOD = "#7A5230";
const RAIL = "#8A8F98";
const PAPER = "#F5F2EC";

// Distance back from the target handle where the direction chevron sits
const CHEVRON_GAP = 22;

// Unit vector pointing *into* the target, given which side of the node the edge arrives on
const INTO_TARGET = {
  [Position.Top]: [0, 1],
  [Position.Bottom]: [0, -1],
  [Position.Left]: [1, 0],
  [Position.Right]: [-1, 0],
};

// Railway edge: the same smooth-step path is stroked several times, bottom to top, to fake a track.
export default function RailEdge({
  sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, label, data,
}) {
  // Edges mount before their handles are measured: bad coordinates would draw stray NaN paths
  const coords = [sourceX, sourceY, targetX, targetY];
  if (!coords.every(Number.isFinite)) return null;

  const [path, midX, midY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    borderRadius: 20, offset: data?.offset, stepPosition: data?.stepPosition,
  });
  if (!path || path.includes("NaN")) return null;
  // Sign position is worked out for the whole diagram in utils/rails.js so signs never collide
  const sign = data?.labelPlacement;
  const labelX = sign?.cx ?? midX;
  const labelY = sign?.cy ?? midY;

  const [dx, dy] = INTO_TARGET[targetPosition] ?? [0, 1];
  const cx = targetX - dx * CHEVRON_GAP;
  const cy = targetY - dy * CHEVRON_GAP;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <>
      <g fill="none" strokeLinejoin="round" pointerEvents="none">
        {/* 1a. Tie outline: slightly fatter/longer dashes in black, sitting under the wood */}
        <path d={path} stroke={OUTLINE} strokeWidth={15} strokeDasharray="8 6" strokeDashoffset={2} />
        {/* 1b. Wooden ties: wide stroke chopped into short dashes, so each dash is one sleeper */}
        <path d={path} stroke={WOOD} strokeWidth={11} strokeDasharray="4 10" />
        {/* 2. Rail outline: black band that outlines both rails */}
        <path d={path} stroke={OUTLINE} strokeWidth={9} strokeLinecap="round" />
        {/* 3. Rails: grey band on top of the outline */}
        <path d={path} stroke={RAIL} strokeWidth={6} strokeLinecap="round" />
        {/* 4. Gap: thin paper-coloured line down the middle, splitting the grey into two rails */}
        <path d={path} stroke={PAPER} strokeWidth={2} strokeLinecap="round" />
        {/* Leader line from the track to its sign, with a dot on the track */}
        {sign && label && (
          <>
            <line x1={sign.px} y1={sign.py} x2={sign.qx} y2={sign.qy} stroke={OUTLINE} strokeWidth={1.5} />
            <circle cx={sign.px} cy={sign.py} r={3.5} fill={OUTLINE} stroke={PAPER} strokeWidth={1.5} />
          </>
        )}
        {/* Direction chevron near the target */}
        <polyline
          points="-4,-5 3,0 -4,5"
          transform={`translate(${cx} ${cy}) rotate(${angle})`}
          stroke={OUTLINE}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>

      {/* Invisible, wider-than-the-track stroke that actually receives clicks */}
      <BaseEdge path={path} style={{ stroke: "transparent", strokeWidth: 0 }} interactionWidth={24} />

      {label && (
        <EdgeLabelRenderer>
          <div
            title={label}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "#FBF9F5",
              border: `2px solid ${OUTLINE}`,
              boxShadow: `2px 2px 0 ${OUTLINE}`,
              color: OUTLINE,
              width: sign?.w,
              height: sign?.h,
              textAlign: "center",
              lineHeight: sign ? `${sign.h - 4}px` : undefined,
              padding: sign ? 0 : undefined,
            }}
            className="nodrag nopan pointer-events-auto absolute whitespace-nowrap rounded-md px-2 py-1 font-mono text-[18px] font-bold leading-none"
          >
            {shortLabel(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
