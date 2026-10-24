import { useState } from "react";
import { Routes, Route, useMatch } from "react-router-dom";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import ChatPanel from "@/components/chat-panel";
import DiagramBoard from "@/components/DiagramBoard.jsx";
import StatsPage from "@/pages/StatsPage.jsx";

// Fake repos for now. Later these will come from the backend.
const repos = [
  { id: "repo_001", name: "jdoe/todo-app" },
  { id: "repo_002", name: "facebook/react" },
  { id: "repo_003", name: "tiangolo/fastapi" },
];

export default function App() {
  // Chat panel open/closed. Lives here so both the sidebar (toggle) and the layout (panel) can use it.
  const [chatOpen, setChatOpen] = useState(false);

  // The selected repo comes from the URL (/repo/:repoId and anything under it)
  const match = useMatch("/repo/:repoId/*");
  const selectedRepoId = match?.params.repoId;
  const selectedRepo = repos.find((r) => r.id === selectedRepoId);

  // Called with a valid GitHub URL from the Add repo dialog
  function handleAddRepo(url) {
    console.log("Add repo:", url);
  }

  return (
    // SidebarProvider holds the collapsed/expanded state
    <SidebarProvider>
      <AppSidebar
        repos={repos}
        selectedRepoId={selectedRepoId}
        onAddRepo={handleAddRepo}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((open) => !open)}
      />
      <SidebarInset className="h-svh min-w-0">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">
            {selectedRepo ? selectedRepo.name : "No repo selected"}
          </span>
        </header>
        {/* Page on the left, optional chat panel on the right */}
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            <Routes>
              <Route path="/" element={<DiagramBoard />} />
              {/* Placeholder: every repo shows the same board until real data is wired in */}
              <Route path="/repo/:repoId" element={<DiagramBoard />} />
              <Route path="/repo/:repoId/stats" element={<StatsPage />} />
            </Routes>
          </div>
          {chatOpen && selectedRepoId && <ChatPanel onClose={() => setChatOpen(false)} />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
