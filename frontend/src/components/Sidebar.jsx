import { useEffect, useState } from "react";

// Left sidebar. For now it only shows whether the backend is reachable.
export default function Sidebar() {
  // "checking" | "connected" | "disconnected"
  const [status, setStatus] = useState("checking");

  // Runs once on page load: ask the backend if it's alive
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status === "ok" ? "connected" : "disconnected"))
      .catch(() => setStatus("disconnected"));
  }, []);

  const color = {
    checking: "bg-yellow-400",
    connected: "bg-green-500",
    disconnected: "bg-red-500",
  }[status];

  return (
    <aside className="w-64 shrink-0 h-full border-r border-gray-200 bg-gray-50 p-4">
      <h1 className="text-lg font-semibold">Repo Diagram</h1>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
        Backend: {status}
      </div>
    </aside>
  );
}
