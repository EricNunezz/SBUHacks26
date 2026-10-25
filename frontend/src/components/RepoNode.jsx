import { Handle, Position } from "@xyflow/react";
import { NODE_WIDTH, NODE_HEIGHT } from "@/utils/layout";
import { getCategoryTheme } from "@/theme/categories";
import { getThemeIcon } from "@/theme/icons";
import { portY, LEFT_PORT_X, RIGHT_PORT_X } from "@/utils/rails";

// Styles live in index.css under "Train-station nodes" (.station, .station-roof, .station-facade, .station-sign, .station-platform).
// Port positions come from utils/rails.js so the tracks and the markers line up.
const portStyle = (x, y) => ({ left: x, top: y, right: "auto", bottom: "auto", transform: "translate(-50%, -50%)" });

export default function RepoNode({ data, selected }) {
  const theme = getCategoryTheme(data.category);
  const Icon = getThemeIcon(theme);
  const inCount = data.ports?.in ?? 1;
  const outCount = data.ports?.out ?? 1;

  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT, "--line": theme.color }}
      className={`station ${selected ? "is-selected" : ""}`}
    >
      {/* Tour: stamped on stations the guided tour has already passed */}
      {data.tourVisited && <div className="tour-stamp" aria-label="Visited">VISITED</div>}

      {/* Incoming tracks: one marker per edge down the left wall */}
      {Array.from({ length: inCount }, (_, i) => {
        return (
          <Handle key={`in-${i}`} id={`in-${i}`} type="target" position={Position.Left}
            className="station-handle" style={portStyle(LEFT_PORT_X, portY(i, inCount))} />
        );
      })}

      {/* Static hard shadow: a flat iron copy of the building, offset 4px. It never animates, so the hover
          lift (the body moving up-left) is what makes the shadow look longer. */}
      <div className="station-shadow" aria-hidden>
        <svg className="station-roof" width={NODE_WIDTH} height="30" viewBox="0 0 260 30">
          <polygon points="130,3 254,23 6,23" />
          <rect x="4" y="21" width="252" height="8" rx="3" />
        </svg>
        <div className="station-facade" />
        <div className="station-platform" />
      </div>

      <div className="station-body">
        <svg className="station-roof" width={NODE_WIDTH} height="30" viewBox="0 0 260 30">
          <polygon points="130,3 254,23 6,23" />
          <rect x="4" y="21" width="252" height="8" rx="3" />
        </svg>

        <div className="station-facade">
          <div className="station-windows">
            <span /><span /><span />
          </div>
          <div className="station-door" />
          <div className="station-window-side" />

          <div className="station-sign" title={data.files?.[0] ? `${data.label} (${data.files[0]})` : data.label}>
            <Icon className="h-5 w-5 shrink-0" style={{ color: theme.color }} />
            <div className="min-w-0">
              <div className="line-clamp-2 break-words text-[16px] font-bold leading-[1.1]" style={{ color: "var(--iron)" }}>
                {data.label}
              </div>
              <div className="font-mono text-[11px] font-bold uppercase leading-tight tracking-wider" style={{ color: theme.color }}>
                {data.category} line
              </div>
            </div>
          </div>
        </div>

        <div className="station-platform" />
      </div>

      {/* Outgoing tracks: one marker per edge down the right wall */}
      {Array.from({ length: outCount }, (_, i) => (
        <Handle key={`out-${i}`} id={`out-${i}`} type="source" position={Position.Right}
          className="station-handle" style={portStyle(RIGHT_PORT_X, portY(i, outCount))} />
      ))}
    </div>
  );
}
