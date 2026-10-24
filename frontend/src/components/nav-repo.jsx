import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, MessageSquare, Network } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// To add/remove/rename nav items, edit this list.
//  - `to(repoId)` makes the item navigate to a URL
//  - `chat: true` makes it toggle the chat panel instead of navigating
const NAV_ITEMS = [
  { title: "Diagram", icon: Network, to: (id) => `/repo/${id}` },
  { title: "AI Chat", icon: MessageSquare, chat: true },
  { title: "Stats", icon: BarChart3, to: (id) => `/repo/${id}/stats` },
];

// The "Repo" nav section. Items are disabled until a repo is selected.
export default function NavRepo({ selectedRepoId, chatOpen, onToggleChat }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onStats = pathname.endsWith("/stats"); // the Stats page is static: no chat there

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Repo</SidebarGroupLabel>
      <SidebarMenu>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          // Chat is "active" while its panel is open; others while the URL matches
          const isActive = item.chat
            ? chatOpen && !onStats
            : !!selectedRepoId && pathname === item.to(selectedRepoId);

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={isActive}
                disabled={!selectedRepoId || (item.chat && onStats)}
                onClick={() => (item.chat ? onToggleChat() : navigate(item.to(selectedRepoId)))}
              >
                <Icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
