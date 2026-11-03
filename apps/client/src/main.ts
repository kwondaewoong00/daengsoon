import { ITEMS, BRAZIERS, SCENES, roomKind, roomIdValid, roomNumber, makeRoomId, seatById, type PlayerState, type RoomInfo, type SceneKind, type ServerMessage, itemById } from "@daengsoon/shared";
import { Ambience } from "./audio";
import { RoomSocket } from "./socket";
import { LocalServer } from "./demo";
import { World } from "./world";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("scene");
const roomNameEl = $("room-name");
const viewerCount = $("viewer-count");
const itemsEl = $("items");
const burnSheet = $("burn-sheet");
const statusChip = $("status-chip");
const statusTitle = $("status-title");
const statusRight = $("status-right");
const statusLine = $("status-line");
const statusSub = $("status-sub");
const actMain = $<HTMLButtonElement>("act-main");
const actMainLabel = $("act-main-label");
const actMainSub = $("act-main-sub");
const actStand = $<HTMLButtonElement>("act-stand");
const joystickEl = $("joystick");
const knob = $("knob");
let burnedToday = 0;
const toast = $("toast");
const loading = $("loading");
const roomsDialog = $<HTMLDialogElement>("rooms");
const roomList = $("room-list");

const world = new World(canvas, $("tags"));
const audio = new Ambience();
world.onCrackle = (strength, near) => audio.crackleAt(strength, near);
world.onTear = () => audio.tear();
let self: PlayerState | null = null;
let room: RoomInfo | null = null;
let lastBurn = 0;
let socket: RoomSocket | LocalServer;
// 체험판: 빌드 시 VITE_DEMO=1 이거나 주소에 ?demo 가 있으면 서버 없이 브라우저 안에서 돌림
const DEMO = import.meta.env.VITE_DEMO === "1" || new URLSearchParams(location.search).has("demo");

const params = new URLSearchParams(location.search);
// 자동 테스트용: ?debug 일 때만 월드를 밖으로 노출
if (params.has("debug")) (window as unknown as { __world?: World }).__world = world;

// ---------- 첫 화면(로비) ----------
const wantedRoom = params.get("room") && roomIdValid(params.get("room")!) ? params.get("room")! : "auto";
const lobby = $("lobby");
const entryForm = $<HTMLFormElement>("entry-form");
{
  let saved: Record<string, string> = {};
  try { saved = JSON.parse(localStorage.getItem("daengsoon:who") ?? "{}"); } catch { /* 무시 */ }
  for (const name of ["age", "gender", "kind"]) {
    const input = entryForm.querySelector<HTMLInputElement>(`input[name="${name}"][value="${saved[name]}"]`);
    if (input) input.checked = true;
  }
  const presetKind = params.get("kind");
  if (presetKind === "sea" || presetKind === "mountain") {
    const k = entryForm.querySelector<HTMLInputElement>(`input[name="kind"][value="${presetKind}"]`);
    if (k) k.checked = true;
  }
  if (wantedRoom !== "auto") {
    $("kind-field").hidden = true;
    $("go-auto").textContent = `${SCENES[roomKind(wantedRoom)].emoji} ${roomNumber(wantedRoom)}번 캠프로`;
    const k = entryForm.querySelector<HTMLInputElement>(`input[name="kind"][value="${roomKind(wantedRoom)}"]`);
    if (k) k.checked = true;
  }
}
function readProfile() {
  const data = new FormData(entryForm);
  const who = { gender: String(data.get("gender")), age: String(data.get("age")), kind: String(data.get("kind")) };
  try { localStorage.setItem("daengsoon:who", JSON.stringify(who)); } catch { /* 무시 */ }
  return who;
}
entryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  // 버튼 클릭은 사용자 동작이라 이 안에서 소리를 켤 수 있음(브라우저 자동재생 제한)
  void audio.enable().then(() => setSoundIcon(true)).catch(() => {});
  const who = readProfile();
  start(who.kind as SceneKind, who, wantedRoom);
});
void makeRoomId;

// 첫 화면의 "지금 N명"
async function refreshLive() {
  const el = $("live-text");
  if (DEMO) { el.textContent = "체험판 · 봇 5명이 불 앞에 앉아 있어요"; return; }
  try {
    const r = await (await fetch("/api/rooms")).json() as { rooms: RoomInfo[]; total: number };
    el.textContent = r.total > 0 ? `지금 ${r.total}명이 불 앞에 앉아 있어요 · 캠프 ${r.rooms.length}곳` : "지금은 아무도 없어요. 첫 불을 피워 보세요";
  } catch {
    el.textContent = "서버에 연결하는 중…";
  }
}
void refreshLive();
window.setInterval(refreshLive, 10_000);

async function start(kind: SceneKind, who: { gender: string; age: string }, roomId: string) {
  lobby.classList.add("fade");
  window.setTimeout(() => (lobby.hidden = true), 900);
  loading.hidden = false;
  audio.setKind(kind);
  const query = { kind, g: who.gender, a: who.age };
  const onStatus = (s: "connecting" | "open" | "closed") => {
    if (s === "connecting") roomNameEl.textContent = "캠프 찾는 중";
    if (s === "closed") viewerCount.textContent = "–";
  };
  socket = DEMO
    ? new LocalServer(kind, query, onMessage, onStatus)
    : new RoomSocket(roomId, query, onMessage, onStatus);
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
      if (!DEMO) history.replaceState(null, "", `?room=${msg.room.id}${params.has("debug") ? "&debug" : ""}`);
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
  renderStatus();
}

/** 아래 상태 카드: 산티아고 길의 "걷는 중 Day 1" 카드처럼, 지금 내 상황을 한 줄로 */
function renderStatus() {
  const seated = self?.seat !== null && self?.seat !== undefined;
  statusChip.textContent = seated ? "앉아 있음" : "걷는 중";
  statusChip.classList.toggle("seated", seated);
  statusTitle.textContent = room?.name ?? "캠프 찾는 중";
  statusRight.textContent = room ? `${room.count} / ${room.capacity}명` : "";
  if (seated) {
    const mySeat = seatById(self!.seat!)!;
    let around = 0;
    for (const c of world.chars.values()) {
      if (c.state.seat === null) continue;
      if (seatById(c.state.seat)?.brazier === mySeat.brazier) around++;
    }
    const fireName = BRAZIERS[mySeat.brazier].size === "large" ? "모닥불" : "내 화로";
    statusLine.textContent = around > 1 ? `${fireName} 옆에 ${around}명이 같이 앉아 있어요` : `${fireName} 옆에 혼자 앉아 있어요`;
    statusSub.textContent = `오늘 ${burnedToday}개 태움 · 쓸어서 고개 돌리기 · 태우기로 뭔가 던져 넣기`;
  } else {
    statusLine.textContent = room ? `이 캠프에 지금 ${room.count}명이 같이 있어요` : "캠프를 찾는 중이에요";
    statusSub.textContent = "조이스틱으로 걷기 · 화면 쓸어서 둘러보기 · 통나무 옆에서 앉기";
  }
  if (seated) {
    actMainLabel.textContent = "태우기";
    actMainSub.textContent = burnSheet.hidden ? "뭔가 꺼내 보기" : "골라서 찢어 넣기";
    $("icon-sit").hidden = true; $("icon-burn").hidden = false;
  } else {
    const near = self ? world.seatNear(self.x, self.y, 260) : null;
    actMainLabel.textContent = "앉기";
    actMainSub.textContent = near ? "여기 통나무에" : "통나무 근처에서";
    actMain.disabled = !near;
    $("icon-sit").hidden = false; $("icon-burn").hidden = true;
    burnSheet.hidden = true;
  }
  if (seated) actMain.disabled = false;
  actStand.hidden = !seated;
  joystickEl.hidden = seated;
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
    burnedToday++;
    setItemsDisabled(true);
    window.setTimeout(() => setItemsDisabled(false), 2500);
    burnSheet.hidden = true;
    renderStatus();
  });
  itemsEl.appendChild(b);
}
function setItemsDisabled(v: boolean) {
  for (const b of itemsEl.querySelectorAll<HTMLButtonElement>("button")) b.disabled = v;
}

// ---------- 큰 버튼 / 일어나기 / 캠프 ----------
actMain.addEventListener("click", () => {
  if (!self) return;
  if (self.seat !== null) {
    burnSheet.hidden = !burnSheet.hidden;
    renderStatus();
    return;
  }
  const seat = world.seatNear(self.x, self.y, 260);
  if (seat) socket.send({ type: "sit", seat: seat.id });
  else showToast("통나무 가까이 가서 눌러요");
});
actStand.addEventListener("click", () => socket.send({ type: "stand" }));
$("act-camp").addEventListener("click", () => $("room-btn").click());
// 걷는 동안 "앉기" 버튼 활성/비활성 갱신
window.setInterval(() => { if (self && self.seat === null) renderStatus(); }, 400);

// ---------- 조이스틱 (경도! 식) ----------
let joy: { id: number; cx: number; cy: number; dx: number; dy: number } | null = null;
const JOY_R = 40;
joystickEl.addEventListener("pointerdown", (e) => {
  const r = joystickEl.getBoundingClientRect();
  joy = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, dx: 0, dy: 0 };
  joystickEl.setPointerCapture(e.pointerId);
  joystickEl.classList.add("active");
  moveJoy(e.clientX, e.clientY);
  wakeHud();
});
joystickEl.addEventListener("pointermove", (e) => { if (joy && e.pointerId === joy.id) moveJoy(e.clientX, e.clientY); });
const endJoy = (e: PointerEvent) => {
  if (!joy || e.pointerId !== joy.id) return;
  joy = null;
  joystickEl.classList.remove("active");
  knob.style.transform = "";
  if (self) socket.send({ type: "move", x: self.x, y: self.y }); // 멈춤
};
joystickEl.addEventListener("pointerup", endJoy);
joystickEl.addEventListener("pointercancel", endJoy);
function moveJoy(x: number, y: number) {
  if (!joy) return;
  let dx = x - joy.cx, dy = y - joy.cy;
  const len = Math.hypot(dx, dy);
  if (len > JOY_R) { dx *= JOY_R / len; dy *= JOY_R / len; }
  joy.dx = dx / JOY_R; joy.dy = dy / JOY_R;
  knob.style.transform = `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px)`;
}
// 조이스틱 방향은 "카메라 기준": 위로 밀면 카메라가 보는 쪽으로
window.setInterval(() => {
  if (!joy || !self || world.rig.focused) return;
  const mag = Math.hypot(joy.dx, joy.dy);
  if (mag < 0.15) return;
  const yaw = world.rig.yawAngle;
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  const rx = -fz, rz = fx; // 오른쪽
  const wx = fx * -joy.dy + rx * joy.dx, wz = fz * -joy.dy + rz * joy.dx;
  const step = 70 * Math.min(1, mag);
  socket.send({ type: "move", x: self.x + wx * step, y: self.y + wz * step });
}, 110);

function updateSeatUI() {
  const seated = self?.seat !== null && self?.seat !== undefined;
  document.body.classList.toggle("seated", seated);
  if (seated && performance.now() - lastBurn > 2500) setItemsDisabled(false);
  world.rig.focusSeat(seated ? self!.seat! : null);
  renderStatus();
}
// 같은 화로에 누가 앉거나 일어나면 카드 숫자 갱신
window.setInterval(renderStatus, 2000);

// ---------- 입력: 탭은 "거기로 걸어가", 그루터기 위면 "앉아" ----------
// 화면 쓸기 = 둘러보기(카메라 회전). 이동은 조이스틱만.
let pointerDown: { x: number; lastX: number } | null = null;
canvas.addEventListener("pointerdown", (e) => { pointerDown = { x: e.clientX, lastX: e.clientX }; });
canvas.addEventListener("pointermove", (e) => {
  if (!pointerDown) return;
  world.rig.orbit(e.clientX - pointerDown.lastX);
  pointerDown.lastX = e.clientX;
});
canvas.addEventListener("pointerup", () => { pointerDown = null; wakeHud(); });
canvas.addEventListener("pointercancel", () => { pointerDown = null; });

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
  if (DEMO) {
    const other = world.kind === "mountain" ? "sea" : "mountain";
    const u = new URL(location.href);
    u.searchParams.set("kind", other);
    u.searchParams.set("demo", "1");
    location.href = u.toString();
    return;
  }
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
function setSoundIcon(on: boolean) {
  $("sound").setAttribute("aria-pressed", String(on));
  $("sound-on").hidden = !on;
  $("sound-off").hidden = on;
}
$("sound").addEventListener("click", async () => {
  const on = !audio.enabled;
  if (on) await audio.enable(); else await audio.disable();
  setSoundIcon(on);
});
$("fullscreen").addEventListener("click", () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
});
let idleTimer: number | undefined;
function wakeHud() {
  $("hud").style.opacity = "1";
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => { $("hud").style.opacity = "0.55"; }, 8000);
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
