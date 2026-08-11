import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw-push.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      },
      includeAssets: ["brand/app-icon.png"],
      devOptions: {
        enabled: false
      },
      manifest: {
        name: "Nenech mě chcípnout!",
        short_name: "Kytky",
        description: "Soukromý hlídač kytek.",
        theme_color: "#2e6f48",
        background_color: "#fbfff5",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/brand/app-icon.png",
            sizes: "1024x1024",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
});
