import { ChevronsUpDown, LogIn, LogOut, Settings, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Top bar user menu (a conductor's badge). `user` is the Supabase user, or null for guests.
// onLogout signs out (if needed), clears saved state and returns home.
export default function NavUser({ user, onLogout }) {
  const label = user?.email ?? "Guest";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex h-11 items-center gap-2 overflow-hidden rounded-lg border-2 border-[var(--iron)] bg-[var(--cream)] px-2 text-left text-[var(--iron)] shadow-[3px_3px_0_var(--iron)] hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5"
        >
          {/* Conductor's badge: brass clip at the top */}
          <span aria-hidden className="absolute left-1/2 top-0 h-1.5 w-8 -translate-x-1/2 rounded-b-sm border-2 border-t-0 border-[var(--iron)] bg-[var(--brass)]" />
          <Avatar className="size-7 rounded-full border-2 border-[var(--iron)]">
            <AvatarFallback className="rounded-full bg-[var(--brass)] font-bold text-[var(--iron)]">{label[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="hide-compact max-w-36 truncate text-sm font-semibold">{label}</span>
          <ChevronsUpDown className="hide-compact size-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-48 rounded-lg"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            {user ? (
              <>
                <DropdownMenuItem>
                  <UserIcon className="size-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onLogout}>
                  <LogOut className="size-4" /> Log out
                </DropdownMenuItem>
              </>
            ) : (
              // Guest: go back to the home page to log in
              <DropdownMenuItem onSelect={onLogout}>
                <LogIn className="size-4" /> Log in
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
    </DropdownMenu>
  );
}
