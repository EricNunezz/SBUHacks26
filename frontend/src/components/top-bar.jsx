import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Compass, Network } from "lucide-react";
import RepoSwitcher from "@/components/repo-switcher";
import BackendStatus from "@/components/backend-status";
import NavUser from "@/components/nav-user";
import { useAuth } from "@/context/AuthContext";

// To add/remove/rename nav tickets, edit this list.
//  - `to(repoId)` is the URL; `always` = usable without a selected repo
//  - color = the ticket's stripe, on = icon colour on that stripe in the compact (icon-only) layout
const NAV_ITEMS = [
  { title: "Diagram", icon: Network, to: (id) => `/repo/${id}`, dest: "The Map", platform: 1, color: "#B87333", on: "#FBF9F5" },
  { title: "Stats", icon: BarChart3, to: (id) => `/repo/${id}/stats`, dest: "The Inspection", platform: 2, color: "#C9A227", on: "#2B2D31" },
  { title: "Explore", icon: Compass, to: () => "/explore", always: true, dest: "Nearby Trains", platform: 3, color: "#A0442C", on: "#FBF9F5" },
];

// The canopy: logo + repo switcher (left), navigation tickets (centre), signal lamp + user badge (right).
// Below ~1200px the tickets and the switcher shrink to icon-only squares (see .topbar rules in index.css).
export default function TopBar({ repos, selectedRepoId, fallbackRepoId, onOpenAddRepo, onDeleteRepo, onLogout, notice }) {
  const { user } = useAuth(); // null for guests
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <header className="canopy topbar flex h-16 shrink-0 items-center gap-4 px-4">
      <div className="topbar-left">
        <span className="hide-compact shrink-0 font-mono text-lg font-extrabold uppercase tracking-[0.14em] text-[var(--brass-bright)]">GitStation</span>
        <RepoSwitcher
          repos={repos}
          selectedRepoId={selectedRepoId}
          onOpenAddRepo={onOpenAddRepo}
          onDeleteRepo={onDeleteRepo}
        />
      </div>

      <nav aria-label="Pages" className="topbar-center">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          // One page is "boarded" at a time: the one whose URL matches
          const routeActive = item.always
            ? pathname.startsWith(item.to())
            : !!selectedRepoId && pathname === item.to(selectedRepoId);
          const targetRepoId = selectedRepoId ?? fallbackRepoId; // where the ticket goes when you are not on a repo page
          const disabled = !targetRepoId && !item.always;

          return (
            <div key={item.title} className={`ticket-item topbar-ticket-item ${disabled ? "is-disabled" : ""}`}>
              <button
                type="button"
                title={`${item.dest} · Platform ${item.platform}`}
                aria-label={item.dest}
                aria-current={routeActive ? "page" : undefined}
                disabled={disabled}
                onClick={() => navigate(item.to(targetRepoId))}
                className={`ticket topbar-ticket flex items-center gap-2 text-left ${routeActive ? "is-boarded" : ""}`}
                style={{ "--stripe": item.color, "--on-stripe": item.on }}
              >
                <Icon className="size-4 shrink-0" />
                <span className="hide-compact flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
                  <span className="flex items-center justify-between gap-2 font-mono text-[8px] font-bold uppercase tracking-wider">
                    <span className="tk-to">To:</span>
                    <span className="tk-platform ml-auto">Platform {item.platform}</span>
                  </span>
                  <span className="flex items-center justify-between gap-1">
                    <span className="min-w-0 truncate text-[12px] font-extrabold uppercase">{item.dest}</span>
                    {routeActive && <span className="ticket-stamp">BOARDED</span>}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </nav>

      <div className="topbar-right">
        {/* Failed add/delete message */}
        {notice && (
          <span className="max-w-48 truncate rounded-md border-2 border-[var(--iron)] bg-[var(--signal-red)] px-2 py-0.5 text-xs font-semibold text-[var(--cream)]" title={notice}>
            {notice}
          </span>
        )}
        <BackendStatus />
        <NavUser user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}
