/// <reference types="vitest" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "ClinicDesk",
        short_name: "ClinicDesk",
        description: "Homoeo Clinic Manager",
        theme_color: "#f5f7fc",
        background_color: "#f5f7fc",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    exclude: [...configDefaults.exclude, "rules-tests/**"],
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
