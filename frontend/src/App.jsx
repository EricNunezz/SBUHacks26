import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Routes,
  Route,
  Navigate,
  matchPath,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import AppSidebar from "@/components/app-sidebar";
import ChatPanel from "@/components/chat-panel";
import DiagramBoard from "@/components/DiagramBoard.jsx";
import HomePage from "@/pages/HomePage.jsx";
import EmptyRepoState from "@/pages/EmptyRepoState.jsx";
import AddRepoDialog from "@/components/add-repo-dialog";
import StatsPage from "@/pages/StatsPage.jsx";
import SignupPage from "@/pages/SignupPage.jsx";
import AuthDialog from "@/components/auth-dialog";
import { AuthProvider, useAuth } from "@/context/AuthContext.jsx";
import {
  savePendingRepo,
  loadPendingRepo,
  clearPendingRepo,
  loadGuestState,
  saveGuestState,
  clearGuestState,
} from "@/utils/pendingRepo";

// Called with a valid GitHub URL (home page or sidebar dialog)
function handleAddRepo(url) {
  // TODO: start the backend generation request here (runs in the background)
  console.log("Add repo:", url);
}

// "https://github.com/owner/repo/" -> "owner/repo"
function repoNameFromUrl(url) {
  return url
    .trim()
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\/$/, "");
}

// Main app layout (sidebar + pages)
function Shell({ repos, onAddRepo, onDeleteRepo, onLogout }) {
  // Chat panel open/closed. Lives here so both the sidebar (toggle) and the layout (panel) can use it.
  const [chatOpen, setChatOpen] = useState(false);
  // Add repo dialog. Lives here so the sidebar and the empty state open the same one.
  const [addRepoOpen, setAddRepoOpen] = useState(false);

  // The selected repo comes from the URL (/repo/:repoId and anything under it)
  const match = useMatch("/repo/:repoId/*");
  const selectedRepoId = match?.params.repoId;
  const selectedRepo = repos.find((r) => r.id === selectedRepoId);

  return (
    // SidebarProvider holds the collapsed/expanded state
    <SidebarProvider>
      <AppSidebar
        repos={repos}
        selectedRepoId={selectedRepoId}
        onOpenAddRepo={() => setAddRepoOpen(true)}
        onDeleteRepo={onDeleteRepo}
        onLogout={onLogout}
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
              {/* With repos, "/" goes to the most recent one; otherwise show the empty state */}
              <Route
                path="/"
                element={
                  repos.length ? (
                    <Navigate to={`/repo/${repos[repos.length - 1].id}`} replace />
                  ) : (
                    <EmptyRepoState onAdd={() => setAddRepoOpen(true)} />
                  )
                }
              />
              {/* Placeholder: every repo shows the same board until real data is wired in */}
              <Route path="/repo/:repoId" element={<DiagramBoard />} />
              <Route path="/repo/:repoId/stats" element={<StatsPage />} />
            </Routes>
          </div>
          {chatOpen && selectedRepoId && (
            <ChatPanel onClose={() => setChatOpen(false)} />
          )}
        </div>
      </SidebarInset>
      <AddRepoDialog open={addRepoOpen} onOpenChange={setAddRepoOpen} onAddRepo={onAddRepo} />
    </SidebarProvider>
  );
}

// Not signed in or guest yet: home page + auth popup. Otherwise: the Shell.
function Gate() {
  const { user, loading, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const saved = loadGuestState();
  const [repos, setRepos] = useState(saved?.repos ?? []);
  const [entered, setEntered] = useState(Boolean(saved?.entered)); // guests only: true after "Continue as guest"
  // The URL waiting for the user to finish the popup (restored after a refresh)
  const [pendingRepoUrl, setPendingRepoUrl] = useState(loadPendingRepo);
  // Returning user clicked "Log in" on the home page (no pending repo)
  const [loginOpen, setLoginOpen] = useState(false);

  // Add a repo to the sidebar list, remember the list, and open it
  function addRepoToList(url, asGuest = false) {
    const name = repoNameFromUrl(url); // "owner/repo"

    // Already have this repo? Just go to it instead of adding a duplicate
    const existing = repos.find(
      (r) => r.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      navigate(`/repo/${existing.id}`);
      return;
    }

    const repo = { id: `repo_${Date.now()}`, name };
    const next = [...repos, repo];
    setRepos(next);
    saveGuestState({ repos: next, entered: entered || asGuest });
    navigate(`/repo/${repo.id}`);
  }

  // Remove a repo from this user's list and keep the saved list in sync
  function deleteRepoFromList(repoId) {
    // TODO: call DELETE /api/me/repos/:id once per-user repos are wired up.
    // This only removes it from the user's list, never the shared cached repo.
    const next = repos.filter((r) => r.id !== repoId);
    setRepos(next);
    saveGuestState({ repos: next, entered });

    // If it was the open repo, move to the next one (or home if none are left)
    const openId = matchPath("/repo/:repoId/*", pathname)?.params.repoId;
    if (openId === repoId) {
      navigate(next[0] ? `/repo/${next[0].id}` : "/");
    }
  }

  // Home form submitted a valid URL: remember it, start generation, popup opens
  function handleHomeSubmit(url) {
    savePendingRepo(url);
    setPendingRepoUrl(url);
    handleAddRepo(url);
  }

  // Popup finished (login, signup, or guest): add the pending repo and enter the app.
  // asGuest is passed explicitly because `user` is still stale in this render.
  function handleContinue(asGuest = false) {
    if (asGuest) setEntered(true); // logged-in users get in through `user` instead

    if (pendingRepoUrl) {
      addRepoToList(pendingRepoUrl, asGuest);
    } else {
      // Returning user: open their most recent repo, or "/" (home input) if they have none
      const latest = repos[repos.length - 1];
      navigate(latest ? `/repo/${latest.id}` : "/");
    }

    clearPendingRepo();
    setPendingRepoUrl("");
    setLoginOpen(false);
  }

  // Popup dismissed: forget the pending repo (if any) and stay on the home page
  function handleCancel() {
    clearPendingRepo();
    setPendingRepoUrl("");
    setLoginOpen(false);
  }

  // Log out: wipe everything stored, then go back to the home page
  async function handleLogout() {
    await signOut(); // no-op for guests (no session)
    clearGuestState();
    clearPendingRepo();
    setRepos([]);
    setEntered(false);
    setPendingRepoUrl("");
    setLoginOpen(false);
    navigate("/");
  }

  // Wait for Supabase to restore the session so the home page doesn't flash on refresh
  if (loading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user || entered) {
    // Already inside: sidebar's Add repo skips the popup
    return (
      <Shell
        repos={repos}
        onAddRepo={(url) => {
          handleAddRepo(url);
          addRepoToList(url);
        }}
        onDeleteRepo={deleteRepoFromList}
        onLogout={handleLogout}
      />
    );
  }

  // Before entering, only "/" exists. Other URLs (like /repo/:id) go back to it.
  if (pathname !== "/") return <Navigate to="/" replace />;

  return (
    <div className="h-svh">
      <HomePage onAddRepo={handleHomeSubmit} onLogin={() => setLoginOpen(true)} />
      {/* Mode comes from pendingRepoUrl: set = "Save your repo", empty = "Welcome back" */}
      <AuthDialog
        open={Boolean(pendingRepoUrl) || loginOpen}
        hasPendingRepo={Boolean(pendingRepoUrl)}
        onCancel={handleCancel}
        onContinue={handleContinue}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Placeholder, reachable directly */}
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Gate />} />
      </Routes>
    </AuthProvider>
  );
}
