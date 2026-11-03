import { ITEMS, BRAZIERS, SCENES, roomKind, roomIdValid, makeRoomId, seatById, type PlayerState, type RoomInfo, type SceneKind, type ServerMessage, itemById } from "@daengsoon/shared";
import { Ambience } from "./audio";
import { RoomSocket } from "./socket";
import { World } from "./world";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("scene");
const roomNameEl = $("room-name");
const viewerCount = $("viewer-count");
const hint = $("hint");
const burnBar = $("burn-bar");
const itemsEl = $("items");
const toast = $("toast");
const loading = $("loading");
const roomsDialog = $<HTMLDialogElement>("rooms");
const roomList = $("room-list");

const world = new World(canvas, $("tags"));
const audio = new Ambience();
let self: PlayerState | null = null;
let room: RoomInfo | null = null;
let lastBurn = 0;
let socket: RoomSocket;

const params = new URLSearchParams(location.search);
// 자동 테스트용: ?debug 일 때만 월드를 밖으로 노출
if (params.has("debug")) (window as unknown as { __world?: World }).__world = world;

// ---------- 입장: "당신은 누구신가요?" ----------
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
entry.addEventListener("cancel", (e) => e.preventDefault());
entry.showModal();

async function start(kind: SceneKind, gender: string, age: string) {
  loading.hidden = false;
  audio.setKind(kind);
  // 하늘·땅을 받는 동안 서버 연결도 같이 진행
  socket = new RoomSocket(wantedRoom, { kind, g: gender, a: age }, onMessage, (s) => {
    if (s === "connecting") roomNameEl.textContent = "캠프 찾는 중";
    if (s === "closed") viewerCount.textContent = "–";
  });
  socket.connect();
  try {
    await world.setKind(kind);
  } catch (e) {
    console.error("풍경 로딩 실패", e);
    showToast("풍경을 불러오지 못했어요. 새로고침해 주세요");
  }
  loading.classList.add("fade");
  window.setTimeout(() => (loading.hidden = true), 900);
}

function onMessage(msg: ServerMessage) {
  switch (msg.type) {
    case "welcome":
      world.clear();
      world.selfId = msg.id;
      for (const p of msg.players) world.upsert(p);
      self = world.chars.get(msg.id)!.state;
      setRoom(msg.room);
      if (world.kind !== msg.room.kind) void world.setKind(msg.room.kind);
      audio.setKind(msg.room.kind);
      history.replaceState(null, "", `?room=${msg.room.id}${params.has("debug") ? "&debug" : ""}`);
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
  world.rig.focusSeat(seated ? self!.seat! : null);
}

// ---------- 입력: 탭은 "거기로 걸어가", 그루터기 위면 "앉아" ----------
// 탭 = 걸어가기/앉기, 좌우로 쓸기 = 둘러보기(카메라 회전)
let pointerDown: { x: number; y: number; lastX: number; dragging: boolean } | null = null;
canvas.addEventListener("pointerdown", (e) => { pointerDown = { x: e.clientX, y: e.clientY, lastX: e.clientX, dragging: false }; });
canvas.addEventListener("pointermove", (e) => {
  if (pointerDown) {
    const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
    if (moved > 12) pointerDown.dragging = true;
    if (pointerDown.dragging && !world.rig.focused) world.rig.orbit(e.clientX - pointerDown.lastX);
    pointerDown.lastX = e.clientX;
    return;
  }
  const w = world.pickGround(e.clientX, e.clientY);
  const seat = w ? world.seatNear(w.x, w.y) : null;
  world.setHoverSeat(seat);
  canvas.classList.toggle("seat-hover", !!seat);
});
canvas.addEventListener("pointercancel", () => { pointerDown = null; });
canvas.addEventListener("pointerup", (e) => {
  if (!pointerDown) return;
  const wasDrag = pointerDown.dragging;
  pointerDown = null;
  if (wasDrag) return;
  const w = world.pickGround(e.clientX, e.clientY);
  if (!w) return;
  const seat = world.seatNear(w.x, w.y, world.rig.focused ? 40 : 55);
  if (world.rig.focused) {
    const mine = self?.seat !== null && self?.seat !== undefined ? seatById(self!.seat!) : undefined;
    if (seat && mine && seat.brazier === mine.brazier) socket.send({ type: "sit", seat: seat.id });
    return;
  }
  if (seat) socket.send({ type: "sit", seat: seat.id });
  else socket.send({ type: "move", x: w.x, y: w.y });
  wakeHud();
});

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
  if (!self || keys.size === 0 || world.rig.focused) return;
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
  for (const r of rooms) {
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
      const used = new Set(rooms.map((r) => r.id));
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

// ---------- 소리 / 전체화면 / HUD ----------
$("sound").addEventListener("click", async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  const on = !audio.enabled;
  if (on) await audio.enable(); else await audio.disable();
  btn.setAttribute("aria-pressed", String(on));
  $("sound-on").hidden = !on;
  $("sound-off").hidden = on;
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

let toastTimer: number | undefined;
function showToast(text: string) {
  toast.textContent = text;
  toast.hidden = false;
  toast.style.animation = "none";
  void toast.offsetWidth;
  toast.style.animation = "";
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.hidden = true), 2500);
}

// ---------- 렌더 루프 ----------
function resize() {
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  world.resize(innerWidth, innerHeight);
}
window.addEventListener("resize", resize);
resize();

let last = performance.now();
function frame(now: number) {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw);
  last = now;
  if (self) {
    const me = world.chars.get(self.id);
    if (me) audio.setNearness(Math.max(0, 1 - world.nearestFireDistance(me.x, me.y) / 420));
  }
  world.update(dt, Math.min(0.3, raw));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 쓰이지 않는 import 방지
void BRAZIERS;
