import { useEffect, useState } from "react";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";

// Footer indicator: pings /api/health once on load.
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
    checking: "bg-gray-300",
    connected: "bg-green-500",
    disconnected: "bg-red-500",
  }[status];
  const text = {
    checking: "Checking backend...",
    connected: "Backend connected",
    disconnected: "Backend not reachable",
  }[status];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/* Collapsed to icons: only the dot stays visible (centered) */}
        <div
          title={text}
          className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:justify-center"
        >
          <span className={`inline-block size-2 shrink-0 rounded-full ${dotColor}`} />
          <span className="truncate group-data-[collapsible=icon]:hidden">{text}</span>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
