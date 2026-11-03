import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  // 체험판 빌드는 상대 경로(어디에 올려도 열림)
  base: process.env.VITE_DEMO === "1" ? "./" : "/",
  server: {
    port: 5173,
    // 개발 중에는 Vite가 화면을 주고, /ws 는 뒤에 있는 Node 서버로 넘겨줍니다(프록시).
    proxy: {
      "/ws": { target: "ws://localhost:8787", ws: true },
      "/healthz": "http://localhost:8787",
    },
  },
  build: { outDir: process.env.VITE_DEMO === "1" ? "dist-demo" : "dist", emptyOutDir: true },
  define: { "import.meta.env.VITE_DEMO": JSON.stringify(process.env.VITE_DEMO ?? "") },
  mode,
}));
