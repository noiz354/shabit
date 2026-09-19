import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

// Wave 1: PWA shell enhanced — installable offline PWA (AUD-PWA-01 + T15)
// - Manifest from public/manifest.webmanifest but also defined inline for precache
// - SW: navigation network-first fallback offline.html, assets cache-first, api network-only + outbox
// - ECharts lazy split (TODO T16)

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png", "offline.html"],
      manifest: {
        name: "HabitWealth",
        short_name: "HabitWealth",
        description: "Rutin harian dan keuangan dalam satu tempat, ringan dan offline-ready.",
        lang: "id",
        dir: "ltr",
        display: "standalone",
        orientation: "portrait",
        start_url: "./?source=pwa",
        scope: "./",
        theme_color: "#0381FE",
        background_color: "#FFFFFF",
        categories: ["finance", "lifestyle"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ],
        shortcuts: [
          {
            name: "Habit hari ini",
            short_name: "Habit",
            description: "Lihat dan selesaikan habit hari ini",
            url: "./#/habit?source=pwa-shortcut",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }]
          },
          {
            name: "Catat pengeluaran",
            short_name: "Catat",
            description: "Tambah transaksi manual",
            url: "./#/uang/add?source=pwa-shortcut",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }]
          }
        ],
        launch_handler: { client_mode: "focus-existing" }
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        // Ensure offline.html is precached
        additionalManifestEntries: [{ url: "offline.html", revision: null }],
        navigateFallback: "offline.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // API: network-only, never cache mutations, outbox handles offline
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            options: {
              backgroundSync: {
                name: "api-queue",
                options: { maxRetentionTime: 24 * 60 }
              }
            }
          },
          {
            // Immutable assets: cache-first
            urlPattern: ({ url }) => url.pathname.match(/\.(?:png|jpg|jpeg|svg|woff2?)$/),
            handler: "CacheFirst",
            options: {
              cacheName: "assets-immutable",
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            // Navigation: network-first with offline fallback (spec 15)
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "navigations",
              networkTimeoutSeconds: 3,
              plugins: [
                {
                  // Fallback to offline.html if both network and cache fail
                  handlerDidError: async () => {
                    // @ts-ignore
                    return await caches.match("offline.html", { ignoreSearch: true });
                  }
                }
              ]
            }
          }
        ],
        // Navigation preload (API 69)
        navigateFallbackAllowlist: [/^\/$/],
        cleanupOutdatedCaches: true,
        // Enable navigation preload where supported (CA/FA)
        navigationPreload: true
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  build: {
    outDir: "dist",
    assetsInlineLimit: 4096
    // TODO(T16): manualChunks echarts saat ECharts dipakai (impor selektif + lazy).
  }
});
