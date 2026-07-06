import { defineConfig, type Plugin } from "vite";
import solid from "vite-plugin-solid";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// The WebKitGTK webview aggressively caches dev assets on disk, which makes
// edits appear not to take effect (stale CSS/JS) until its cache is cleared.
// Tell it never to cache anything the dev server hands out.
const disableWebviewCache: Plugin = {
  name: "wisty-disable-webview-cache",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    });
  },
};

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [solid(), disableWebviewCache],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
}));
