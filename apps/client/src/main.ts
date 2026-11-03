import { ITEMS, BRAZIERS, SCENES, roomKind, roomIdValid, makeRoomId, seatById, type PlayerState, type RoomInfo, type SceneKind, type ServerMessage, itemById } from "@daengsoon/shared";
import { Ambience } from "./audio";
import { Camera } from "./camera";
import { RoomSocket } from "./socket";
import { World } from "./world";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("scene");
const ctx = canvas.getContext("2d")!;
const roomNameEl = $("room-name");
const viewerCount = $("viewer-count");
const hint = $("hint");
const burnBar = $("burn-bar");
const itemsEl = $("items");
const toast = $("toast");
const roomsDialog = $<HTMLDialogElement>("rooms");
const roomList = $("room-list");

const world = new World();
const camera = new Camera();
// 자동 테스트용: ?debug 일 때만 카메라를 밖으로 노출
if (params_debug()) (window as unknown as { __camera?: Camera }).__camera = camera;
function params_debug() { return new URLSearchParams(location.search).has("debug"); }
const audio = new Ambience();
let self: PlayerState | null = null;
let room: RoomInfo | null = null;
let lastBurn = 0;
let socket: RoomSocket;

// ---------- 입장: "당신은 누구신가요?" ----------
// 매번 묻되, 지난번 선택은 미리 채워 둡니다.
const params = new URLSearchParams(location.search);
const wantedRoom = params.get("room") && roomIdValid(params.get("room")!) ? params.get("room")! : "auto";
const entry = $<HTMLDialogElement>("entry");
const entryForm = $<HTMLFormElement>("entry-form");
{
  let saved: Record<string, string> = {};
  try { saved = JSON.parse(localStorage.getItem("daengsoon:who") ?? "{}"); } catch { /* 무시 */ }
  for (const [name, value] of Object.entries(saved)) {
    const input = entryForm.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  }
  // 특정 캠프로 바로 온 경우엔 종류를 고를 필요가 없음
  if (wantedRoom !== "auto") {
    $("kind-field").hidden = true;
    const k = entryForm.querySelector<HTMLInputElement>(`input[name="kind"][value="${roomKind(wantedRoom)}"]`);
    if (k) k.checked = true;
  }
}
entryForm.addEventListener("submit", () => {
  const data = new FormData(entryForm);
  const who = { gender: String(data.get("gender")), age: String(data.get("age")), kind: String(data.get("kind")) };
  try { localStorage.setItem("daengsoon:who", JSON.stringify(who)); } catch { /* 무시 */ }
  start(who.kind as SceneKind, who.gender, who.age);
});
entry.addEventListener("cancel", (e) => e.preventDefault()); // ESC로 못 닫음: 답해야 들어감
entry.showModal();

function start(kind: SceneKind, gender: string, age: string) {
  world.kind = kind;
  audio.setKind(kind);
  socket = new RoomSocket(wantedRoom, { kind, g: gender, a: age }, onMessage, (s) => {
    if (s === "connecting") roomNameEl.textContent = "캠프 찾는 중";
    if (s === "closed") viewerCount.textContent = "–";
  });
  socket.connect();
}

function onMessage(msg: ServerMessage) {
  switch (msg.type) {
    case "welcome":
      world.clear();
      world.selfId = msg.id;
      for (const p of msg.players) world.upsert(p);
      self = world.avatars.get(msg.id)!.state;
      setRoom(msg.room);
      world.kind = msg.room.kind;
      audio.setKind(msg.room.kind);
      history.replaceState(null, "", `?room=${msg.room.id}`);
      updateSeatUI();
      break;
    case "join":
      world.upsert(msg.player);
      break;
    case "leave":
      world.remove(msg.id);
      break;
    case "update":
      for (const p of msg.players) {
        world.patch(p);
        if (p.id === world.selfId) updateSeatUI();
      }
      break;
    case "room":
      setRoom(msg.room);
      break;
    case "burn": {
      world.burn(msg.id, msg.seat, msg.item);
      audio.whoosh();
      const def = itemById(msg.item);
      if (def) showToast(msg.id === world.selfId ? def.line : `누군가 ${def.label}를 태웠어요 ${def.emoji}`);
      break;
    }
    case "denied":
      if (msg.reason === "seat-taken") showToast("방금 누가 앉았어요");
      if (msg.reason === "cooldown") showToast("불이 아직 삼키는 중이에요");
      break;
    case "full":
      roomNameEl.textContent = "캠프가 가득 찼어요";
      showRooms(msg.rooms);
      break;
  }
}

function setRoom(r: RoomInfo) {
  room = r;
  roomNameEl.textContent = r.name;
  viewerCount.textContent = String(r.count);
  document.title = `댕순 — ${r.name} · ${r.count}명이 함께`;
}

// ---------- 앉기/일어나기 UI ----------
for (const it of ITEMS) {
  const b = document.createElement("button");
  b.className = "item";
  b.dataset.item = it.id;
  b.innerHTML = `<span class="e">${it.emoji}</span><span>${it.label}</span>`;
  b.addEventListener("click", () => {
    socket.send({ type: "burn", item: it.id });
    lastBurn = performance.now();
    setItemsDisabled(true);
    window.setTimeout(() => setItemsDisabled(false), 2500);
  });
  itemsEl.appendChild(b);
}
function setItemsDisabled(v: boolean) {
  for (const b of itemsEl.querySelectorAll<HTMLButtonElement>("button")) b.disabled = v;
}
$("stand").addEventListener("click", () => socket.send({ type: "stand" }));

function updateSeatUI() {
  const seated = self?.seat !== null && self?.seat !== undefined;
  burnBar.hidden = !seated;
  hint.hidden = seated;
  document.body.classList.toggle("seated", seated);
  if (seated && performance.now() - lastBurn > 2500) setItemsDisabled(false);
  // 앉으면 그 화로로 카메라가 들어감. 일어나면 다시 넓게.
  const seat = seated ? seatById(self!.seat!) : undefined;
  if (seat) {
    const b = BRAZIERS[seat.brazier];
    camera.focusOn(b.x, b.y, b.size === "large" ? 240 : 180);
  } else {
    camera.clearFocus();
  }
}

// ---------- 입력: 클릭/탭은 "거기로 걸어가", 통나무 위면 "앉아" ----------
let pointerDown: { x: number; y: number; t: number } | null = null;
canvas.addEventListener("pointerdown", (e) => {
  pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener("pointermove", (e) => {
  const w = camera.toWorld(e.clientX, e.clientY);
  world.hoverSeat = world.seatNear(w.x, w.y);
  canvas.classList.toggle("seat-hover", !!world.hoverSeat);
});
canvas.addEventListener("pointerup", (e) => {
  if (!pointerDown) return;
  const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
  pointerDown = null;
  if (moved > 12) return; // 드래그는 무시
  const w = camera.toWorld(e.clientX, e.clientY);
  const seat = world.seatNear(w.x, w.y, camera.focused ? 36 : 48);
  if (camera.focused) {
    // 앉아 있을 땐 같은 화로의 다른 빈자리로 옮기는 것만 허용. 나머지 탭은 무시(실수로 일어나지 않게)
    const mine = self?.seat !== null && self?.seat !== undefined ? seatById(self!.seat!) : undefined;
    if (seat && mine && seat.brazier === mine.brazier) socket.send({ type: "sit", seat: seat.id });
    return;
  }
  if (seat) socket.send({ type: "sit", seat: seat.id });
  else socket.send({ type: "move", x: w.x, y: w.y });
  wakeHud();
});

// 키보드: 방향키/WASD로 걷기
const keys = new Set<string>();
const KEY_DIR: Record<string, [number, number]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
};
window.addEventListener("keydown", (e) => {
  if (e.code in KEY_DIR && !(e.target instanceof HTMLInputElement)) { keys.add(e.code); e.preventDefault(); }
  if (e.code === "Space" && self?.seat !== null) socket.send({ type: "stand" });
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.setInterval(() => {
  if (!self || keys.size === 0 || camera.focused) return;
  let dx = 0, dy = 0;
  for (const k of keys) { const d = KEY_DIR[k]; if (d) { dx += d[0]; dy += d[1]; } }
  if (!dx && !dy) return;
  const len = Math.hypot(dx, dy);
  socket.send({ type: "move", x: self.x + (dx / len) * 60, y: self.y + (dy / len) * 60 });
}, 120);

// ---------- 방 목록 ----------
$("room-btn").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/rooms");
    const data = (await res.json()) as { rooms: RoomInfo[] };
    showRooms(data.rooms);
  } catch {
    showToast("캠프 목록을 못 가져왔어요");
  }
});
$("rooms-close").addEventListener("click", () => roomsDialog.close());
function showRooms(rooms: RoomInfo[]) {
  roomList.innerHTML = "";
  const list = rooms.length ? rooms : [];
  for (const r of list) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = `<span>${SCENES[r.kind].emoji} ${r.name}</span><span>${r.count}/${r.capacity}</span>`;
    b.disabled = r.count >= r.capacity;
    b.setAttribute("aria-current", String(r.id === room?.id));
    b.addEventListener("click", () => { location.search = `?room=${r.id}`; });
    li.appendChild(b);
    roomList.appendChild(li);
  }
  for (const kind of ["mountain", "sea"] as SceneKind[]) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = `<span>${SCENES[kind].emoji} 새 ${SCENES[kind].label} 캠프 열기</span><span>+</span>`;
    b.addEventListener("click", () => {
      const used = new Set(list.map((r) => r.id));
      for (let n = 1; n <= 50; n++) {
        const id = makeRoomId(kind, n);
        if (!used.has(id)) { location.search = `?room=${id}`; return; }
      }
    });
    li.appendChild(b);
    roomList.appendChild(li);
  }
  roomsDialog.showModal();
}

// ---------- 소리 / 전체화면 / HUD 숨김 ----------
$("sound").addEventListener("click", async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  if (audio.enabled) { await audio.disable(); btn.textContent = "🔇"; btn.setAttribute("aria-pressed", "false"); }
  else { await audio.enable(); btn.textContent = "🔊"; btn.setAttribute("aria-pressed", "true"); }
});
$("fullscreen").addEventListener("click", () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
});
let idleTimer: number | undefined;
function wakeHud() {
  $("hud").style.opacity = "1";
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => { if (burnBar.hidden) $("hud").style.opacity = "0.25"; }, 6000);
}
for (const ev of ["pointermove", "pointerdown", "keydown"]) window.addEventListener(ev, wakeHud, { passive: true });
wakeHud();

void (async () => {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<unknown> } };
    await nav.wakeLock?.request("screen");
  } catch { /* 지원 안 함 */ }
})();

function showToast(text: string) {
  toast.textContent = text;
  toast.hidden = false;
  toast.style.animation = "none";
  void toast.offsetWidth;
  toast.style.animation = "";
  window.clearTimeout((showToast as unknown as { t?: number }).t);
  (showToast as unknown as { t?: number }).t = window.setTimeout(() => (toast.hidden = true), 2500);
}

// ---------- 렌더 루프 ----------
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  camera.resize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
resize();

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  const me = self ? world.avatars.get(self.id) : undefined;
  if (me) {
    camera.follow(me.x, me.y);
    // 가장 가까운 화로까지의 거리로 소리 크기
    let nearest = Infinity;
    for (const b of BRAZIERS) nearest = Math.min(nearest, Math.hypot(b.x - me.x, b.y - me.y));
    audio.setNearness(Math.max(0, 1 - nearest / 420));
  }
  camera.update(dt);
  world.update(dt, t);

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#0a0806";
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.save();
  camera.apply(ctx);
  world.draw(ctx, t);
  ctx.restore();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
