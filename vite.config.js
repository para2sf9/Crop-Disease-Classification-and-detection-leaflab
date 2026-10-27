import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server forwards /api/* to the local proxy in server/index.js so the
// Kindwise API key never reaches the browser bundle.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
