import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@daengsoon/shared";
import { Room } from "./room.js";

const PORT = Number(process.env.PORT ?? 8787);
const here = fileURLToPath(new URL(".", import.meta.url));
// 배포(production)에서는 빌드된 클라이언트를 이 서버가 그대로 서빙합니다. 서버 하나로 끝.
const CLIENT_DIST = process.env.CLIENT_DIST ?? join(here, "../../client/dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

const room = new Room();
const clients = new Map<WebSocket, { id: string; lastSeen: number }>();

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg: ServerMessage) {
  const data = JSON.stringify(msg);
  for (const ws of clients.keys()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function broadcastState() {
  broadcast({ type: "state", state: room.snapshot() });
}

// ---------- HTTP: 정적 파일 + 헬스체크 ----------
const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, ...room.snapshot() }));
    return;
  }

  // 경로 탈출(../) 방지: normalize 후 dist 바깥이면 거부
  const safePath = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(CLIENT_DIST, safePath);
  if (!filePath.startsWith(CLIENT_DIST)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    // SPA fallback: 모르는 경로는 index.html
    filePath = join(CLIENT_DIST, "index.html");
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[extname(filePath)] ?? "application/octet-stream",
      "cache-control": filePath.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("클라이언트가 아직 빌드되지 않았어요. `pnpm build`를 먼저 실행하세요.");
  }
});

// ---------- WebSocket: 실시간 동시접속 ----------
const wss = new WebSocketServer({ server: http, path: "/ws" });

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2, 8);
  clients.set(ws, { id, lastSeen: Date.now() });
  room.join();
  send(ws, { type: "welcome", id, state: room.snapshot() });
  broadcastState();

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const meta = clients.get(ws);
    if (!meta) return;
    meta.lastSeen = Date.now();

    switch (msg.type) {
      case "ping":
        send(ws, { type: "pong" });
        break;
      case "setMode":
        if (msg.mode !== "fire" && msg.mode !== "water") return;
        if (room.setMode(msg.mode)) broadcastState();
        break;
      case "poke":
        room.poke();
        broadcast({ type: "poke", from: meta.id, at: Date.now() });
        broadcastState();
        break;
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    room.leave();
    broadcastState();
  });
  ws.on("error", () => ws.close());
});

// 1초마다 장작이 타들어가는 걸 반영. 변했을 때만 알림.
setInterval(() => {
  if (room.tick()) broadcastState();
}, 1000);

// 끊긴 줄 모르는 연결(좀비) 정리: 30초 동안 아무 말 없으면 끊기
setInterval(() => {
  const now = Date.now();
  for (const [ws, meta] of clients) {
    if (now - meta.lastSeen > 30_000) ws.terminate();
  }
}, 10_000);

http.listen(PORT, () => {
  console.log(`🔥 daengsoon server listening on http://localhost:${PORT}`);
});
