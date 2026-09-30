import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "KidCare — สมุดสุขภาพลูก",
        short_name: "KidCare",
        description: "บันทึกวัคซีน การแพ้ยา และนัดหมอของลูก",
        theme_color: "#101522",
        background_color: "#101522",
        display: "standalone",
        orientation: "portrait",
        lang: "th",
        start_url: "/",
        icons: [],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"] },
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "dist" },
});
