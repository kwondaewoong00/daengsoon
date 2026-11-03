import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { parseProfile, type ClientMessage, type Room, type ServerMessage } from "@daengsoon/shared";
import { RoomManager } from "./rooms.js";

const PORT = Number(process.env.PORT ?? 8787);
const here = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_DIST = process.env.CLIENT_DIST ?? join(here, "../../client/dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

const rooms = new RoomManager();

// ---------- HTTP ----------
const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.list() }));
    return;
  }
  if (url.pathname === "/api/rooms") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ rooms: rooms.list(), capacity: RoomManager.capacity, total: rooms.totalCount() }));
    return;
  }

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

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server: http, path: "/ws" });
const meta = new Map<WebSocket, { id: string; room: Room; lastSeen: number }>();

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const wanted = url.searchParams.get("room") ?? "auto";
  const kind = url.searchParams.get("kind") === "sea" ? "sea" : "mountain";
  const q = url.searchParams;
  const profile = parseProfile({ nick: q.get("nick"), species: q.get("species"), hue: q.get("hue"), g: q.get("g"), a: q.get("a") });
  const room = wanted === "auto" ? rooms.auto(kind) : rooms.open(wanted);

  const send = (msg: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  if (!room) {
    send({ type: "full", rooms: rooms.list() });
    ws.close(4001, "room full");
    return;
  }

  const id = Math.random().toString(36).slice(2, 9);
  meta.set(ws, { id, room, lastSeen: Date.now() });
  room.join({ id, send }, profile);

  ws.on("message", (raw) => {
    const m = meta.get(ws);
    if (!m) return;
    m.lastSeen = Date.now();
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
    m.room.handle(m.id, msg);
  });

  const bye = () => {
    const m = meta.get(ws);
    if (!m) return;
    meta.delete(ws);
    m.room.leave(m.id);
  };
  ws.on("close", bye);
  ws.on("error", () => ws.close());
});

// 시뮬레이션 20Hz, 전송 10Hz. "계산은 자주, 말은 덜" — 네트워크를 아낍니다.
setInterval(() => rooms.tickAll(Date.now()), 50);
setInterval(() => rooms.flushAll(), 100);
// 좀비 연결 정리 + 빈 방 정리
setInterval(() => {
  const now = Date.now();
  for (const [ws, m] of meta) {
    if (now - m.lastSeen > 45_000) ws.terminate();
  }
  rooms.sweep();
}, 10_000);

http.listen(PORT, () => {
  console.log(`🔥 daengsoon server listening on http://localhost:${PORT}`);
});
