import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tailwind v4 runs as a Vite plugin, so no tailwind.config file is needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/components/..." resolves to "src/components/..." (also set in jsconfig.json)
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    port: 5173,
    // Forward /api calls to the FastAPI backend during development
    proxy: { "/api": "http://localhost:8000" },
  },
});
