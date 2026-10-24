// Shared category palette for diagram nodes. Edit colors/icons here.
// `icon` is a lucide-react export name (look it up with `icons[name]` or import it directly).
export const CATEGORY_THEME = {
  frontend: { color: "#4A6FA5", icon: "Gauge" }, // steel blue
  backend: { color: "#B87333", icon: "Cog" }, // copper
  database: { color: "#C9A227", icon: "Cylinder" }, // brass
  config: { color: "#6B7280", icon: "Wrench" }, // iron gray
  external: { color: "#4E9C8F", icon: "Plug" }, // verdigris
  infra: { color: "#A0442C", icon: "Factory" }, // rust
};

// Unknown categories fall back to config
export function getCategoryTheme(category) {
  return CATEGORY_THEME[category] ?? CATEGORY_THEME.config;
}
