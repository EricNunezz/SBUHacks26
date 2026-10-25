import { Cog } from "lucide-react";
import { cn } from "@/lib/utils";

const SPIN = "animate-[spin_14s_linear_infinite]";

// A steel outline cog with a solid copper copy stacked on top, revealed bottom-up by progress (0-100).
// The clip sits on a non-rotating wrapper so the fill line stays level while the cogs turn.
// With `error` it stops, drops the fill and turns rust.
export default function ProgressCog({ progress, error = false, size = 96 }) {
  const spin = error ? "" : SPIN;
  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <Cog
        size={size}
        strokeWidth={1.5}
        className={cn("absolute inset-0", spin)}
        style={{ color: error ? "var(--rust)" : "var(--steel)" }}
      />
      {!error && (
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(${100 - progress}% 0 0 0)` }}
        >
          <Cog
            size={size}
            strokeWidth={1.5}
            fill="var(--copper)"
            stroke="var(--copper)"
            className={spin}
          />
        </div>
      )}
    </div>
  );
}
