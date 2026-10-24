import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, GitBranch, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import AddRepoDialog from "@/components/add-repo-dialog";

// "owner/repo" -> { owner, name }
function splitName(fullName) {
  const [owner, name] = fullName.split("/");
  return { owner, name };
}

// Replaces sidebar-07's team switcher: pick a repo or add a new one.
export default function RepoSwitcher({ repos, selectedRepoId, onAddRepo }) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const selected = repos.find((r) => r.id === selectedRepoId);
  const info = selected ? splitName(selected.name) : null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <GitBranch className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{info ? info.name : "Select a repo"}</span>
                <span className="truncate text-xs">{info ? info.owner : "No repo selected"}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Repos</DropdownMenuLabel>
            {repos.map((repo) => {
              const { owner, name } = splitName(repo.name);
              return (
                <DropdownMenuItem key={repo.id} onSelect={() => navigate(`/repo/${repo.id}`)}>
                  <GitBranch className="size-4" />
                  <div className="grid leading-tight">
                    <span className="text-sm">{name}</span>
                    <span className="text-xs text-muted-foreground">{owner}</span>
                  </div>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Add repo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      {/* Rendered outside the dropdown so it stays open after the menu closes */}
      <AddRepoDialog open={dialogOpen} onOpenChange={setDialogOpen} onAddRepo={onAddRepo} />
    </SidebarMenu>
  );
}
