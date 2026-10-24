import { Cog } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import RepoSwitcher from "@/components/repo-switcher";
import NavRepo from "@/components/nav-repo";
import BackendStatus from "@/components/backend-status";
import NavUser from "@/components/nav-user";
import { useAuth } from "@/context/AuthContext";

// The whole sidebar: repo switcher (top), nav (middle), status + user (bottom).
// collapsible="icon" makes it shrink to an icon strip instead of hiding.
export default function AppSidebar({ repos, selectedRepoId, onOpenAddRepo, onDeleteRepo, onLogout, chatOpen, onToggleChat }) {
  const { user } = useAuth(); // null for guests
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* App mark sits beside the switcher; hidden in the collapsed icon strip */}
        <div className="flex items-center gap-1">
          <Cog className="ml-1 size-6 shrink-0 text-copper group-data-[collapsible=icon]:hidden" aria-label="App logo" />
          <div className="min-w-0 flex-1">
            <RepoSwitcher
              repos={repos}
              selectedRepoId={selectedRepoId}
              onOpenAddRepo={onOpenAddRepo}
              onDeleteRepo={onDeleteRepo}
            />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavRepo
          selectedRepoId={selectedRepoId}
          chatOpen={chatOpen}
          onToggleChat={onToggleChat}
        />
      </SidebarContent>
      <SidebarFooter>
        <BackendStatus />
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>
      {/* Thin draggable edge that also toggles collapse */}
      <SidebarRail />
    </Sidebar>
  );
}
