import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/ELCHK_Exhibition/" : "/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
}));
