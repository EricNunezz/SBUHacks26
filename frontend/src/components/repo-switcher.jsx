import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, GitBranch, MoreVertical, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// "owner/repo" -> { owner, name }
function splitName(fullName) {
  const [owner, name] = fullName.split("/");
  return { owner, name };
}

// Top bar repo switcher, styled as a ticket stub: pick a repo or add a new one.
export default function RepoSwitcher({ repos, selectedRepoId, onOpenAddRepo, onDeleteRepo }) {
  const navigate = useNavigate();
  const [repoToDelete, setRepoToDelete] = useState(null); // repo awaiting confirmation

  const selected = repos.find((r) => r.id === selectedRepoId);
  const info = selected ? splitName(selected.name) : null;

  return (
    <>
      <div className="ticket-item">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="ticket ticket-right topbar-ticket flex items-center gap-2">
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg border-2 border-[var(--iron)] bg-[var(--brass)] text-[var(--iron)]">
                <GitBranch className="size-4" />
              </div>
              <div className="hide-compact grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold">{info ? info.name : "Select a repo"}</span>
                <span className="truncate font-mono text-[11px]">{info ? info.owner : "No repo selected"}</span>
              </div>
              <ChevronsUpDown className="hide-compact absolute right-2 top-1/2 -translate-y-1/2" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Repos</DropdownMenuLabel>
            {repos.length === 0 && (
              <DropdownMenuItem disabled>No repos yet</DropdownMenuItem>
            )}
            {repos.map((repo) => {
              const { owner, name } = splitName(repo.name);
              return (
                <div key={repo.id} className="group flex items-center gap-1">
                  <DropdownMenuItem
                    className="flex-1"
                    onSelect={() => navigate(`/repo/${repo.id}`)}
                  >
                    <GitBranch className="size-4" />
                    <div className="grid leading-tight">
                      <span className="text-sm">{name}</span>
                      <span className="text-xs text-muted-foreground">{owner}</span>
                    </div>
                  </DropdownMenuItem>

                  {/* Sibling of the row (not inside it), so clicks here never select the repo */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Options for ${repo.name}`}
                        className="text-muted-foreground opacity-40 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="right">
                      <DropdownMenuItem variant="destructive" onSelect={() => setRepoToDelete(repo)}>
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenAddRepo}>
              <Plus className="size-4" />
              Add repo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation, outside the dropdown so it stays open after the menu closes */}
      <AlertDialog
        open={Boolean(repoToDelete)}
        onOpenChange={(open) => !open && setRepoToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {repoToDelete?.name} from your repos?</AlertDialogTitle>
            <AlertDialogDescription>
              This only removes it from your list. You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => onDeleteRepo(repoToDelete.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
