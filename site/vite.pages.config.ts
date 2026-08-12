import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/travel-database/",
  plugins: [react()],
  build: {
    outDir: "pages-dist",
    emptyOutDir: true,
  },
});
