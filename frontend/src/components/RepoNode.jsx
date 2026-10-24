import { Handle, Position } from "@xyflow/react";
import { NODE_WIDTH, NODE_HEIGHT } from "@/utils/layout";
import { getCategoryTheme } from "@/theme/categories";
import { getThemeIcon } from "@/theme/icons";

export default function RepoNode({ data, selected }) {
  const theme = getCategoryTheme(data.category);
  const Icon = getThemeIcon(theme);

  return (
    <div
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        borderLeftColor: theme.color,
      }}
      className={`flex items-center gap-3 rounded-md border border-l-4 bg-card px-3 shadow-sm transition-shadow hover:shadow-md ${
        selected ? "ring-2 ring-primary" : ""
      }`}
    >
      {/* Incoming pipes attach at the top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!border-0 !bg-transparent"
      />

      <Icon className="h-5 w-5 shrink-0" style={{ color: theme.color }} />

      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{data.label}</div>
        <div
          className="font-mono text-[10px] uppercase tracking-wider"
          style={{ color: theme.color }}
        >
          {data.category}
        </div>
      </div>

      {/* Outgoing pipes leave from the bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!border-0 !bg-transparent"
      />
    </div>
  );
}
