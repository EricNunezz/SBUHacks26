import { useEffect, useRef, useState } from "react";
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
import AuthDialog from "@/components/auth-dialog";
import { AuthProvider, useAuth } from "@/context/AuthContext.jsx";
import { getMyRepos, addMyRepo, deleteMyRepo, setUnauthorizedHandler } from "@/api/client";
import { Button } from "@/components/ui/button";
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
// reposStatus is "loading" | "ready" | "error" (only logged-in users ever see loading/error)
function Shell({ repos, newestRepoId, reposStatus, onRetry, notice, onAddRepo, onDeleteRepo, onLogout }) {
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
          {/* Failed add/delete message */}
          {notice && <span className="ml-auto text-xs text-destructive">{notice}</span>}
        </header>
        {/* Page on the left, optional chat panel on the right */}
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            {reposStatus === "loading" ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : reposStatus === "error" ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <p className="text-sm text-destructive">Couldn't load your repos.</p>
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              </div>
            ) : (
            <Routes>
              {/* With repos, "/" goes to the most recent one; otherwise show the empty state */}
              <Route
                path="/"
                element={
                  repos.length ? (
                    <Navigate to={`/repo/${newestRepoId}`} replace />
                  ) : (
                    <EmptyRepoState onAdd={() => setAddRepoOpen(true)} />
                  )
                }
              />
              {/* Placeholder: every repo shows the same board until real data is wired in */}
              <Route path="/repo/:repoId" element={<DiagramBoard />} />
              <Route path="/repo/:repoId/stats" element={<StatsPage />} />
            </Routes>
            )}
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
  // Guests keep their repos in localStorage; logged-in users get theirs from the backend
  const [guestRepos, setGuestRepos] = useState(saved?.repos ?? []);
  const [userRepos, setUserRepos] = useState([]);
  const [reposStatus, setReposStatus] = useState("loading"); // backend list: loading | ready | error
  const [notice, setNotice] = useState(""); // error from a failed add / delete
  const loadSeq = useRef(0); // lets a newer list fetch win over an older one
  const repos = user ? userRepos : guestRepos;
  // Backend list is newest first; the guest list is in append order (newest last)
  const newestRepoId = (user ? repos[0] : repos[repos.length - 1])?.id;
  const [entered, setEntered] = useState(Boolean(saved?.entered)); // guests only: true after "Continue as guest"
  // The URL waiting for the user to finish the popup (restored after a refresh)
  const [pendingRepoUrl, setPendingRepoUrl] = useState(loadPendingRepo);
  // Returning user clicked "Log in" on the home page (no pending repo)
  const [loginOpen, setLoginOpen] = useState(false);

  // Fetch the logged-in user's list from the backend. Only the latest fetch is applied.
  async function refreshUserRepos() {
    const seq = ++loadSeq.current;
    try {
      const list = await getMyRepos();
      if (seq === loadSeq.current) {
        setUserRepos(list);
        setReposStatus("ready");
      }
      return list;
    } catch (err) {
      if (seq === loadSeq.current) setReposStatus("error");
      throw err;
    }
  }

  // Show a failed add / delete, unless it was a 401 (the client already signs out)
  function reportError(err, fallback) {
    if (err.status !== 401) setNotice(err.message || fallback);
  }

  // Guest: add to the localStorage list and open it
  function addRepoAsGuest(url) {
    const name = repoNameFromUrl(url); // "owner/repo"

    // Already have this repo? Just go to it instead of adding a duplicate
    const existing = guestRepos.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      navigate(`/repo/${existing.id}`);
      return;
    }

    const repo = { id: `repo_${Date.now()}`, name };
    const next = [...guestRepos, repo];
    setGuestRepos(next);
    saveGuestState({ repos: next, entered: true });
    navigate(`/repo/${repo.id}`);
  }

  // Logged in: POST to the backend, refresh the list, open the returned repo.
  // `current` is the list to check for duplicates (passed in because it can be stale right after login).
  async function addRepoAsUser(url, current) {
    const name = repoNameFromUrl(url);
    const existing = current.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      navigate(`/repo/${existing.id}`);
      return;
    }
    try {
      setNotice("");
      const repo = await addMyRepo(url);
      await refreshUserRepos();
      navigate(`/repo/${repo.id}`);
    } catch (err) {
      reportError(err, "Couldn't add that repo.");
    }
  }

  // Remove a repo from this user's list (never the shared cached repo)
  async function deleteRepoFromList(repoId) {
    if (user) {
      try {
        setNotice("");
        await deleteMyRepo(repoId);
      } catch (err) {
        reportError(err, "Couldn't remove that repo.");
        return;
      }
      setUserRepos(userRepos.filter((r) => r.id !== repoId));
    } else {
      const next = guestRepos.filter((r) => r.id !== repoId);
      setGuestRepos(next);
      saveGuestState({ repos: next, entered });
    }

    // If it was the open repo, move to the next one (or home if none are left)
    const next = repos.filter((r) => r.id !== repoId);
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
  async function handleContinue(asGuest = false) {
    const url = pendingRepoUrl;
    clearPendingRepo();
    setPendingRepoUrl("");
    setLoginOpen(false);

    if (asGuest) {
      setEntered(true); // logged-in users get in through `user` instead
      addRepoAsGuest(url);
      return;
    }

    // Logged in or signed up: use the backend list (newest first), not the stale local one
    try {
      const list = await refreshUserRepos();
      if (url) await addRepoAsUser(url, list);
      else navigate(list[0] ? `/repo/${list[0].id}` : "/"); // most recent, or empty state
    } catch (err) {
      reportError(err, "Couldn't load your repos.");
    }
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
    setGuestRepos([]);
    setUserRepos([]);
    setReposStatus("loading");
    setNotice("");
    setEntered(false);
    setPendingRepoUrl("");
    setLoginOpen(false);
    navigate("/");
  }

  // Load the backend list whenever a user logs in (or the page reloads with a session)
  useEffect(() => {
    if (!user) return;
    setReposStatus("loading");
    refreshUserRepos().catch(() => {}); // status is set to "error" inside
  }, [user?.id]);

  // A 401 from any API call means the session expired: sign out and go home
  useEffect(() => {
    setUnauthorizedHandler(handleLogout);
    return () => setUnauthorizedHandler(null);
  });

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
        newestRepoId={newestRepoId}
        reposStatus={user ? reposStatus : "ready"}
        onRetry={() => {
          setReposStatus("loading");
          refreshUserRepos().catch(() => {});
        }}
        notice={notice}
        onAddRepo={(url) => {
          handleAddRepo(url);
          if (user) addRepoAsUser(url, userRepos);
          else addRepoAsGuest(url);
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
        <Route path="*" element={<Gate />} />
      </Routes>
    </AuthProvider>
  );
}
