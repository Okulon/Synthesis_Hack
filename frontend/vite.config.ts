import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1337,
    /** If 1337 is taken (stale `vite` / another app), try the next port instead of failing. */
    strictPort: false,
  },
});
