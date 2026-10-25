import { useEffect, useState } from "react";

// Top bar indicator: pings /api/health once on load and shows a signal lamp.
export default function BackendStatus() {
  // "checking" | "connected" | "disconnected"
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status === "ok" ? "connected" : "disconnected"))
      .catch(() => setStatus("disconnected"));
  }, []);

  const dotColor = {
    checking: "bg-[var(--brass-tint)]",
    connected: "bg-[#7BE0A4]",
    disconnected: "bg-[#E5533D]",
  }[status];
  const text = {
    checking: "Checking backend...",
    connected: "Backend connected",
    disconnected: "Backend not reachable",
  }[status];

  return (
    <div title={text} aria-label={text} role="status" className="flex items-center gap-2 text-xs font-medium text-[var(--cream)]">
      {/* signal lamp: iron-outlined circle */}
      <span className={`inline-block size-4 shrink-0 rounded-full border-2 border-[var(--iron)] ${dotColor}`} />
    </div>
  );
}
