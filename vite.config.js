import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

// Scaffold-only: ECharts di-split lazy (jangan import statis di entry).
// Sources: vite.dev/guide/build, vite-plugin-pwa docs, echarts.apache.org/handbook (import on demand).
export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "HabitWealth",
        short_name: "HabitWealth",
        lang: "id",
        display: "standalone",
        start_url: "./?source=pwa",
        scope: "./",
        theme_color: "#0381FE",
        background_color: "#FFFFFF",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly"
          }
        ]
      }
    })
  ],
  build: {
    outDir: "dist",
    assetsInlineLimit: 4096
    // TODO(T16): manualChunks echarts saat ECharts dipakai (impor selektif + lazy).
  }
});
