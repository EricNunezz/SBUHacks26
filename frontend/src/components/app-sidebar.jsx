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
        {/* App mark */}
        <div className="flex items-center px-2 pt-1 group-data-[collapsible=icon]:justify-center">
          <Cog className="size-6 text-copper" aria-label="App logo" />
        </div>
        <RepoSwitcher
          repos={repos}
          selectedRepoId={selectedRepoId}
          onOpenAddRepo={onOpenAddRepo}
          onDeleteRepo={onDeleteRepo}
        />
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
