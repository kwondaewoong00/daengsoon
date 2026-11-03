import type { Mode, RoomState } from "@daengsoon/shared";
import { Ambience } from "./audio";
import { FireScene } from "./fire";
import { WaterScene } from "./water";
import { RoomSocket } from "./socket";
import type { Scene } from "./scene";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const hud = document.getElementById("hud")!;
const viewerCount = document.getElementById("viewer-count")!;
const pokeBtn = document.getElementById("poke") as HTMLButtonElement;
const soundBtn = document.getElementById("sound") as HTMLButtonElement;
const fullscreenBtn = document.getElementById("fullscreen") as HTMLButtonElement;
const modeBtns = [...document.querySelectorAll<HTMLButtonElement>(".mode")];
const toast = document.getElementById("toast")!;

const scenes: Record<Mode, Scene> = { fire: new FireScene(), water: new WaterScene() };
const audio = new Ambience();
let mode: Mode = "fire";
let intensity = 0.5;   // 서버가 알려준 목표값
let shownIntensity = 0.5; // 화면은 부드럽게 따라감

// ---------- 캔버스 ----------
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const s of Object.values(scenes)) s.resize(w, h, dpr);
}
window.addEventListener("resize", resize);
resize();

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  shownIntensity += (intensity - shownIntensity) * Math.min(1, dt * 2);
  scenes[mode].draw(ctx, now / 1000, dt, shownIntensity);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- 서버 연결 ----------
const socket = new RoomSocket()
  .on("state", applyState)
  .on("poke", (from) => {
    scenes[mode].burst();
    audio.pop();
    if (from !== socket.selfId) showToast(mode === "fire" ? "누군가 장작을 넣었어요 🔥" : "누군가 돌을 던졌어요 💧");
  })
  .on("disconnected", () => {
    viewerCount.textContent = "…";
  });
socket.connect();

function applyState(state: RoomState) {
  intensity = state.intensity;
  audio.setIntensity(state.intensity);
  viewerCount.textContent = String(state.viewers);
  if (state.mode !== mode) setLocalMode(state.mode);
}

function setLocalMode(next: Mode) {
  mode = next;
  document.documentElement.dataset.mode = next;
  for (const b of modeBtns) b.setAttribute("aria-selected", String(b.dataset.mode === next));
  pokeBtn.textContent = next === "fire" ? "장작 넣기" : "돌 던지기";
  document.title = next === "fire" ? "댕순 — 같이 보는 불멍" : "댕순 — 같이 보는 물멍";
  audio.setMode(next);
}
setLocalMode("fire");

// ---------- 조작 ----------
for (const b of modeBtns) {
  b.addEventListener("click", () => socket.send({ type: "setMode", mode: b.dataset.mode as Mode }));
}
pokeBtn.addEventListener("click", () => socket.send({ type: "poke" }));

soundBtn.addEventListener("click", async () => {
  if (audio.enabled) {
    await audio.disable();
    soundBtn.textContent = "🔇";
    soundBtn.setAttribute("aria-pressed", "false");
  } else {
    await audio.enable(mode);
    soundBtn.textContent = "🔊";
    soundBtn.setAttribute("aria-pressed", "true");
  }
});

fullscreenBtn.addEventListener("click", () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
});

// 가만히 있으면 HUD가 사라지고, 움직이면 다시 나타남 (멍 때리기 방해 금지)
let idleTimer: number | undefined;
function wake() {
  hud.classList.remove("idle");
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => hud.classList.add("idle"), 4000);
}
for (const ev of ["pointermove", "pointerdown", "keydown", "touchstart"]) {
  window.addEventListener(ev, wake, { passive: true });
}
wake();

// 화면 꺼짐 방지 (지원하는 브라우저에서만)
void (async () => {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<unknown> } };
    await nav.wakeLock?.request("screen");
  } catch {
    /* 지원 안 함 — 조용히 넘어감 */
  }
})();

function showToast(text: string) {
  toast.textContent = text;
  toast.hidden = false;
  // 애니메이션 재시작
  toast.style.animation = "none";
  void toast.offsetWidth;
  toast.style.animation = "";
  window.setTimeout(() => (toast.hidden = true), 2300);
}
