import path from "path";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "FLVX",
        short_name: "FLVX",
        description: "FLVX forwarding management panel",
        theme_color: "#2563eb",
        background_color: "#f6f7fb",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The backend and frontend are upgraded together, so a new worker
        // takes over immediately instead of waiting for every tab to close.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // index.html is precached only as the offline fallback below. With
        // directoryIndex disabled the precache never answers a navigation
        // itself; otherwise a reload would keep serving the pre-upgrade shell.
        globPatterns: ["**/*.{js,css,html}"],
        directoryIndex: null,
        navigateFallback: null,
        runtimeCaching: [
          {
            // Reloads fetch the current shell from the server and fall back
            // to the last copy only when offline or the network hangs.
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" &&
              !/^\/(?:api|flow|system-info)(?:\/|$)/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "flux-shell",
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  // Every SPA route is the same document; keep one copy.
                  cacheKeyWillBeUsed: async () => "/index.html",
                  // Offline before any navigation was cached (e.g. right
                  // after install): use the precached shell.
                  handlerDidError: async () =>
                    caches.match("/index.html", { ignoreSearch: true }),
                },
              ],
            },
          },
        ],
      },
    }),
  ],
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://127.0.0.1:6365",
        changeOrigin: true,
      },
      "/system-info": {
        target: process.env.VITE_API_PROXY || "http://127.0.0.1:6365",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: true,
  },
});
