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
import TopBar from "@/components/top-bar";
import ChatPanel from "@/components/chat-panel";
import DiagramBoard from "@/components/DiagramBoard.jsx";
import HomePage from "@/pages/HomePage.jsx";
import EmptyRepoState from "@/pages/EmptyRepoState.jsx";
import AddRepoDialog from "@/components/add-repo-dialog";
import StatsPage from "@/pages/StatsPage.jsx";
import ExplorePage from "@/pages/ExplorePage.jsx";
import AddRepoProgress from "@/pages/AddRepoProgress.jsx";
import AuthDialog from "@/components/auth-dialog";
import { AuthProvider, useAuth } from "@/context/AuthContext.jsx";
import { ChatProvider } from "@/context/ChatContext.jsx";
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

// "https://github.com/owner/repo/" -> "owner/repo"
function repoNameFromUrl(url) {
  return url
    .trim()
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\/$/, "");
}

// Main app layout (sidebar + pages)
// reposStatus is "loading" | "ready" | "error" (only logged-in users ever see loading/error)
function Shell({
  repos,
  newestRepoId,
  reposStatus,
  onRetry,
  notice,
  adding,
  onAddRepo,
  onDeleteRepo,
  onLogout,
  onReposChanged,
}) {
  // Add repo dialog. Lives here so the top bar and the empty state open the same one.
  const [addRepoOpen, setAddRepoOpen] = useState(false);

  // The selected repo comes from the URL (/repo/:repoId and anything under it)
  const match = useMatch("/repo/:repoId/*");
  const selectedRepoId = match?.params.repoId;
  const selectedRepo = repos.find((r) => r.id === selectedRepoId);
  // Off a repo page (e.g. on Explore), The Map / The Inspection still work: they open the last repo you viewed, else the newest
  const lastRepoId = useRef(null);
  if (selectedRepoId) lastRepoId.current = selectedRepoId;
  const navRepoId = selectedRepoId ?? repos.find((r) => r.id === lastRepoId.current)?.id ?? newestRepoId;
  const onStats = Boolean(useMatch("/repo/:repoId/stats")); // no chat on the static Stats page
  // Featured repos: /explore (the timetable) and /explore/:repoId (a featured map)
  const exploreRepoId = useMatch("/explore/:repoId")?.params.repoId;
  const onExplore = Boolean(useMatch("/explore/*") || useMatch("/explore"));
  const { user } = useAuth();
  const exploreChatMessage = !user
    ? "Sign up to ask the conductor"
    : repos.some((r) => r.id === exploreRepoId)
      ? "Open this line from your repos to ask the conductor"
      : "Add this line to your repos to ask the conductor";

  return (
    <div className="flex h-svh min-w-0 flex-col">
      <TopBar
        repos={repos}
        selectedRepoId={selectedRepoId}
        fallbackRepoId={navRepoId}
        onOpenAddRepo={() => setAddRepoOpen(true)}
        onDeleteRepo={onDeleteRepo}
        onLogout={onLogout}
        notice={notice}
      />
        {/* Page on the left, optional chat panel on the right */}
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">
            {adding ? (
              <AddRepoProgress
                key={adding.id}
                name={repoNameFromUrl(adding.url)}
                runAdd={adding.run}
                onComplete={adding.onComplete}
                onAddDifferent={() => {
                  adding.onCancel();
                  setAddRepoOpen(true);
                }}
              />
            ) : reposStatus === "loading" ? (
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
            <div className="h-full animate-in fade-in duration-700">
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
              <Route path="/explore" element={<ExplorePage onMapped={onReposChanged} onSignUp={onLogout} />} />
              <Route path="/explore/:repoId" element={<DiagramBoard explore repos={repos} onAddRepo={onAddRepo} />} />
            </Routes>
            </div>
            )}
          </div>
          {selectedRepoId && !onStats && <ChatPanel repoName={selectedRepo?.name} />}
          {exploreRepoId && <ChatPanel repoName="Featured line" blockedMessage={exploreChatMessage} />}
        </div>
      <AddRepoDialog open={addRepoOpen} onOpenChange={setAddRepoOpen} onAddRepo={onAddRepo} />
    </div>
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
  const [addingUrl, setAddingUrl] = useState(""); // repo being generated; shows the progress screen
  const addId = useRef(0); // new key per add so the progress screen restarts
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

  // Logged in: show the progress screen, which POSTs to the backend (generation runs inside it).
  // `current` is the list to check for duplicates (passed in because it can be stale right after login).
  function addRepoAsUser(url, current) {
    const name = repoNameFromUrl(url);
    const existing = current.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      navigate(`/repo/${existing.id}`);
      return;
    }
    setNotice("");
    addId.current += 1;
    setAddingUrl(url);
  }

  // What the progress screen runs: add, then refresh the sidebar list (a refresh failure isn't an add failure)
  async function runAdd(url) {
    const repo = await addMyRepo(url);
    await refreshUserRepos().catch(() => {});
    return repo;
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
      if (url) addRepoAsUser(url, list);
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
    setAddingUrl("");
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

  const onExplorePath = pathname === "/explore" || pathname.startsWith("/explore/");
  if (user || entered || onExplorePath) {
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
        adding={
          addingUrl && {
            id: addId.current,
            url: addingUrl,
            run: () => runAdd(addingUrl),
            onComplete: (repo) => {
              setAddingUrl("");
              navigate(`/repo/${repo.id}`);
            },
            onCancel: () => setAddingUrl(""),
          }
        }
        onAddRepo={(url) => (user ? addRepoAsUser(url, userRepos) : addRepoAsGuest(url))}
        onDeleteRepo={deleteRepoFromList}
        onLogout={handleLogout}
        onReposChanged={() => (user ? refreshUserRepos().catch(() => {}) : undefined)}
      />
    );
  }

  // Before entering, only "/" exists. Other URLs (like /repo/:id) go back to it.
  if (pathname !== "/") return <Navigate to="/" replace />;

  return (
    <div className="h-svh">
      <HomePage onAddRepo={handleHomeSubmit} onLogin={() => setLoginOpen(true)} onExplore={() => navigate("/explore")} />
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
      <ChatProvider>
        <Routes>
          <Route path="*" element={<Gate />} />
        </Routes>
      </ChatProvider>
    </AuthProvider>
  );
}
