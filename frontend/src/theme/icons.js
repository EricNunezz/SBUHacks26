import { Gauge, Cog, Cylinder, Wrench, Plug, Factory } from "lucide-react";

// categories.js stores icon NAMES, so map names to the actual components.
// Importing only these six keeps the bundle small.
const ICONS = { Gauge, Cog, Cylinder, Wrench, Plug, Factory };

// Icon component for a category theme (see getCategoryTheme)
export function getThemeIcon(theme) {
  return ICONS[theme.icon] ?? Wrench;
}
