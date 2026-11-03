import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    // 개발 중에는 Vite가 화면을 주고, /ws 는 뒤에 있는 Node 서버로 넘겨줍니다(프록시).
    proxy: {
      "/ws": { target: "ws://localhost:8787", ws: true },
      "/healthz": "http://localhost:8787",
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
