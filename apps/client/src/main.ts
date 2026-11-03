import { ITEMS, BRAZIERS, SCENES, SPECIES, SHIRT_HUES, PUBLIC_ROOMS, MAX_ROOMS, roomKind, roomIdValid, roomNumber, makeRoomId, seatById, randomNick, type PlayerState, type RoomInfo, type SceneKind, type Species, type ServerMessage, itemById } from "@daengsoon/shared";
import { renderPortraits } from "./portraits";
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
const actSeat = $<HTMLButtonElement>("act-seat");
const actSeatLabel = $("act-seat-label");
const actBurn = $<HTMLButtonElement>("act-burn");
let burnedToday = 0;
const toast = $("toast");
const loading = $("loading");
const roomsDialog = $<HTMLDialogElement>("rooms");
const roomList = $("room-list");

const world = new World(canvas, $("tags"));
const audio = new Ambience();
world.onCrackle = (strength, near) => audio.crackleAt(strength, near);
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
const nickInput = $<HTMLInputElement>("nick");
const speciesGrid = $("species-grid");
const swatches = $("swatches");
let chosenSpecies: Species = "dog";
let chosenHue = SHIRT_HUES[0];

{
  let saved: Record<string, string> = {};
  try { saved = JSON.parse(localStorage.getItem("daengsoon:who") ?? "{}"); } catch { /* 무시 */ }
  if (saved.nick) nickInput.value = saved.nick;
  nickInput.placeholder = `예: ${randomNick()}`;
  if (SPECIES.some((sp) => sp.id === saved.species)) chosenSpecies = saved.species as Species;
  if (saved.hue && SHIRT_HUES.includes(Number(saved.hue))) chosenHue = Number(saved.hue);
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
    $("go-auto").textContent = roomNumber(wantedRoom) > PUBLIC_ROOMS ? "초대받은 캠프 들어가기" : `${SCENES[roomKind(wantedRoom)].emoji} ${roomNumber(wantedRoom)}번 캠프 들어가기`;
    $("go-friends").hidden = true;
    const k = entryForm.querySelector<HTMLInputElement>(`input[name="kind"][value="${roomKind(wantedRoom)}"]`);
    if (k) k.checked = true;
  }
}

// 옷 색
for (const hue of SHIRT_HUES) {
  const label = document.createElement("label");
  const sat = hue === 0 ? 0 : 60, light = hue === 0 ? 22 : hue === 220 ? 30 : 68;
  label.innerHTML = `<input type="radio" name="hue" value="${hue}" ${hue === chosenHue ? "checked" : ""}><span class="sw" style="background:hsl(${hue} ${sat}% ${light}%)"></span>`;
  swatches.appendChild(label);
}
swatches.addEventListener("change", () => {
  chosenHue = Number((entryForm.querySelector('input[name="hue"]:checked') as HTMLInputElement).value);
  buildSpecies();
});
// 동물 친구: 실제 3D 모델을 그려서 초상화로
function buildSpecies() {
  let portraits: Record<Species, string> | null = null;
  try { portraits = renderPortraits(chosenHue); } catch (e) { console.warn("portrait render failed", e); }
  speciesGrid.innerHTML = "";
  for (const sp of SPECIES) {
    const label = document.createElement("label");
    label.innerHTML = `<input type="radio" name="species" value="${sp.id}" ${sp.id === chosenSpecies ? "checked" : ""}><div class="pick">${portraits ? `<img alt="${sp.label}" src="${portraits[sp.id]}">` : ""}<span>${sp.label}</span></div>`;
    speciesGrid.appendChild(label);
  }
}
speciesGrid.addEventListener("change", () => {
  chosenSpecies = (entryForm.querySelector('input[name="species"]:checked') as HTMLInputElement).value as Species;
});
buildSpecies();

function readProfile() {
  const data = new FormData(entryForm);
  const who = {
    nick: nickInput.value.trim().slice(0, 12),
    species: chosenSpecies,
    hue: String(chosenHue),
    gender: String(data.get("gender")),
    age: String(data.get("age")),
    kind: String(data.get("kind")),
  };
  try { localStorage.setItem("daengsoon:who", JSON.stringify(who)); } catch { /* 무시 */ }
  return who;
}
entryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const who = readProfile();
  start(who.kind as SceneKind, who, wantedRoom);
});
// 친구랑 캠프 만들기: 21~50번 중 하나를 골라 링크로만 들어오는 캠프
$("go-friends").addEventListener("click", () => {
  const who = readProfile();
  const n = PUBLIC_ROOMS + 1 + Math.floor(Math.random() * (MAX_ROOMS - PUBLIC_ROOMS));
  start(who.kind as SceneKind, who, makeRoomId(who.kind as SceneKind, n));
});
// 캠프 코드: "산 37", "바다 3", "37" 모두 허용
$("go-code").addEventListener("click", () => {
  const raw = $<HTMLInputElement>("code").value.trim();
  const m = /^(산|바다|mountain|sea)?\s*(\d{1,2})$/.exec(raw);
  if (!m) { showToast("캠프 코드는 '산 37'처럼 적어요"); return; }
  const who = readProfile();
  const kind: SceneKind = /바다|sea/.test(m[1] ?? "") ? "sea" : m[1] ? "mountain" : (who.kind as SceneKind);
  const id = makeRoomId(kind, Number(m[2]));
  if (!roomIdValid(id)) { showToast("없는 캠프 번호예요"); return; }
  start(kind, who, id);
});

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

async function start(kind: SceneKind, who: { nick: string; species: string; hue: string; gender: string; age: string }, roomId: string) {
  lobby.classList.add("fade");
  window.setTimeout(() => (lobby.hidden = true), 900);
  loading.hidden = false;
  audio.setKind(kind);
  const query = { kind, nick: who.nick, species: who.species, hue: who.hue, g: who.gender, a: who.age };
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
    statusSub.textContent = "땅을 누르면 걸어가요 · 쓸어서 둘러보기 · 통나무 옆에서 앉기";
  }
  actSeatLabel.textContent = seated ? "일어나기" : "앉기";
  actSeat.classList.toggle("primary", seated);
  actBurn.disabled = !seated;
  if (!seated) burnSheet.hidden = true;
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
    renderStatus();
  });
  itemsEl.appendChild(b);
}
function setItemsDisabled(v: boolean) {
  for (const b of itemsEl.querySelectorAll<HTMLButtonElement>("button")) b.disabled = v;
}

// ---------- 아이콘 바 ----------
actSeat.addEventListener("click", () => {
  if (!self) return;
  if (self.seat !== null) { socket.send({ type: "stand" }); return; }
  const seat = world.seatNear(self.x, self.y, 260);
  if (seat) socket.send({ type: "sit", seat: seat.id });
  else showToast("통나무 가까이 가서 눌러요");
});
actBurn.addEventListener("click", () => {
  burnSheet.hidden = !burnSheet.hidden;
  actBurn.classList.toggle("on", !burnSheet.hidden);
});
$("act-look").addEventListener("click", () => {
  // 걸을 땐 카메라를 90도 돌리고, 앉았을 땐 옆 사람 쪽으로 고개를 돌림
  world.rig.orbit(world.rig.focused ? 200 : -260);
});
$("act-camp").addEventListener("click", () => $("room-btn").click());
$("act-more").addEventListener("click", (e) => {
  const tools = document.querySelector<HTMLElement>(".tools")!;
  tools.classList.toggle("open");
  (e.currentTarget as HTMLElement).classList.toggle("on", tools.classList.contains("open"));
});

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
// 탭 = 걸어가기/앉기, 좌우로 쓸기 = 둘러보기(카메라 회전)
let pointerDown: { x: number; y: number; lastX: number; dragging: boolean } | null = null;
canvas.addEventListener("pointerdown", (e) => { pointerDown = { x: e.clientX, y: e.clientY, lastX: e.clientX, dragging: false }; });
canvas.addEventListener("pointermove", (e) => {
  if (pointerDown) {
    const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
    if (moved > 12) pointerDown.dragging = true;
    if (pointerDown.dragging) world.rig.orbit(e.clientX - pointerDown.lastX);
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
function inviteUrl() {
  const u = new URL(location.href);
  u.search = "";
  if (room) u.searchParams.set("room", room.id);
  return u.toString();
}
$("invite-copy").addEventListener("click", async () => {
  const url = inviteUrl();
  const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
  try {
    if (nav.share) { await nav.share({ title: "댕순", text: `${room?.name ?? "캠프"}에서 같이 불멍해요`, url }); return; }
  } catch { /* 공유 취소 */ }
  try { await navigator.clipboard.writeText(url); showToast("초대 링크를 복사했어요"); }
  catch { showToast("주소창의 링크를 복사해 주세요"); }
});
function showRooms(rooms: RoomInfo[]) {
  $("invite-name").textContent = room ? `${room.name} 초대하기` : "이 캠프";
  $("invite-url").textContent = inviteUrl().replace(/^https?:\/\//, "");
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
