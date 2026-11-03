import { BRAZIERS, HORIZON_Y, SEATS, WORLD, itemById, seatById, type ItemId, type PlayerState, type SceneKind, type Seat } from "@daengsoon/shared";
import { FirePit } from "./fire";

/** 화면에 그리기 위한 캐릭터. 서버 좌표(target)를 부드럽게 따라갑니다(lerp). */
export interface Avatar {
  state: PlayerState;
  x: number;
  y: number;
  facing: number;
  /** 걷기 애니메이션 위상 */
  step: number;
}

interface BurnFx {
  item: ItemId;
  fromX: number; fromY: number;
  toX: number; toY: number;
  t: number;
  pit: FirePit;
  fired: boolean;
}
interface Ash { x: number; y: number; vx: number; vy: number; life: number; size: number }

/**
 * World = 캠프장 전체를 그리는 화가.
 * 상태를 바꾸지 않습니다. 서버가 준 상태를 받아 매 프레임 그릴 뿐입니다.
 */
export class World {
  readonly pits: FirePit[] = BRAZIERS.map((b) => new FirePit(b));
  readonly avatars = new Map<string, Avatar>();
  private burns: BurnFx[] = [];
  private ashes: Ash[] = [];
  private groundCache: HTMLCanvasElement | null = null;
  private _kind: SceneKind = "mountain";
  selfId = "";

  get kind() { return this._kind; }
  set kind(k: SceneKind) {
    if (k !== this._kind) this.groundCache = null;
    this._kind = k;
  }
  hoverSeat: Seat | null = null;

  // ---------- 상태 반영 ----------
  upsert(p: PlayerState) {
    const a = this.avatars.get(p.id);
    if (a) {
      a.state = { ...a.state, ...p };
    } else {
      this.avatars.set(p.id, { state: p, x: p.x, y: p.y, facing: p.facing, step: 0 });
    }
  }
  patch(p: Partial<PlayerState> & { id: string }) {
    const a = this.avatars.get(p.id);
    if (a) Object.assign(a.state, p);
  }
  remove(id: string) {
    this.avatars.delete(id);
  }
  clear() {
    this.avatars.clear();
    this.burns = [];
  }

  burn(playerId: string, seatId: number, item: ItemId) {
    const seat = seatById(seatId);
    const a = this.avatars.get(playerId);
    if (!seat) return;
    const pit = this.pits[seat.brazier];
    this.burns.push({
      item,
      fromX: a?.x ?? seat.x, fromY: (a?.y ?? seat.y) - 26,
      toX: pit.brazier.x, toY: pit.brazier.y - 10,
      t: 0, pit, fired: false,
    });
  }

  // ---------- 매 프레임 ----------
  update(dt: number, t: number) {
    for (const a of this.avatars.values()) {
      const k = Math.min(1, dt * 10);
      a.x += (a.state.x - a.x) * k;
      a.y += (a.state.y - a.y) * k;
      a.facing += angleDiff(a.facing, a.state.facing) * Math.min(1, dt * 8);
      if (a.state.moving) a.step += dt * 9;
    }
    for (const pit of this.pits) pit.update(dt, t);

    this.burns = this.burns.filter((b) => {
      b.t += dt;
      if (b.t >= 0.75 && !b.fired) {
        b.fired = true;
        b.pit.burn(itemById(b.item)?.flash ?? "#fff");
        for (let i = 0; i < 26; i++) {
          this.ashes.push({
            x: b.toX + (Math.random() - 0.5) * 20, y: b.toY,
            vx: (Math.random() - 0.5) * 50, vy: -(40 + Math.random() * 90),
            life: 1.2 + Math.random() * 1.6, size: 1.5 + Math.random() * 2.5,
          });
        }
      }
      return b.t < 1.1;
    });
    this.ashes = this.ashes.filter((a) => {
      a.life -= dt;
      a.vx += Math.sin(t * 3 + a.y * 0.05) * 30 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vy *= 1 - dt * 0.6;
      return a.life > 0;
    });
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    this.drawGround(ctx);
    this.drawHorizonLive(ctx, t);
    for (const pit of this.pits) pit.drawGlow(ctx);
    this.drawSeats(ctx);
    for (const b of BRAZIERS) this.drawBrazierBody(ctx, b.x, b.y, b.size);

    // 깊이 정렬: 아래(y가 큰 것)에 있는 게 앞. 불꽃도 캐릭터와 함께 정렬.
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const pit of this.pits) items.push({ y: pit.brazier.y, draw: () => pit.drawFlames(ctx) });
    for (const a of this.avatars.values()) items.push({ y: a.y, draw: () => this.drawAvatar(ctx, a, t) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();

    this.drawBurns(ctx);
    this.drawAshes(ctx);
    this.drawVignette(ctx);
  }

  // ---------- 그리기 세부 ----------
  /** 한 번만 그려두는 배경: 저녁 하늘 + 먼 풍경(산 또는 바다 수평선) + 땅 */
  private drawGround(ctx: CanvasRenderingContext2D) {
    if (!this.groundCache) {
      const c = document.createElement("canvas");
      c.width = WORLD.w; c.height = WORLD.h;
      const g = c.getContext("2d")!;
      const sea = this._kind === "sea";

      // 저녁 하늘: 위는 남색, 수평선 근처는 주황
      const sky = g.createLinearGradient(0, 0, 0, HORIZON_Y);
      sky.addColorStop(0, sea ? "#0b1530" : "#0d1226");
      sky.addColorStop(0.55, sea ? "#2a2a52" : "#2b2446");
      sky.addColorStop(1, sea ? "#c9683a" : "#b8562e");
      g.fillStyle = sky;
      g.fillRect(0, 0, WORLD.w, HORIZON_Y);
      // 별
      for (let i = 0; i < 140; i++) {
        const x = Math.random() * WORLD.w, y = Math.random() * HORIZON_Y * 0.6;
        g.fillStyle = `rgba(255, 245, 230, ${0.3 + Math.random() * 0.6})`;
        g.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
      }
      // 해 지는 빛
      const sun = g.createRadialGradient(WORLD.w * 0.62, HORIZON_Y - 6, 0, WORLD.w * 0.62, HORIZON_Y - 6, 260);
      sun.addColorStop(0, "rgba(255, 190, 110, 0.55)");
      sun.addColorStop(1, "rgba(255, 150, 80, 0)");
      g.fillStyle = sun;
      g.fillRect(0, 0, WORLD.w, HORIZON_Y);

      if (sea) {
        // 바다 띠 (수평선 아래 ~ HORIZON_Y). 물결은 매 프레임 따로 그림
        const seaTop = HORIZON_Y - 70;
        const water = g.createLinearGradient(0, seaTop, 0, HORIZON_Y);
        water.addColorStop(0, "#3a3c6a");
        water.addColorStop(1, "#14283a");
        g.fillStyle = water;
        g.fillRect(0, seaTop, WORLD.w, HORIZON_Y - seaTop);
        // 모래
        g.fillStyle = "#3b3226";
        g.fillRect(0, HORIZON_Y, WORLD.w, WORLD.h - HORIZON_Y);
        for (let i = 0; i < 7000; i++) {
          const x = Math.random() * WORLD.w, y = HORIZON_Y + Math.random() * (WORLD.h - HORIZON_Y);
          g.fillStyle = `rgba(${90 + Math.random() * 50}, ${75 + Math.random() * 40}, ${50 + Math.random() * 25}, ${0.2 + Math.random() * 0.35})`;
          g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
        }
        // 젖은 모래 경계
        const wet = g.createLinearGradient(0, HORIZON_Y, 0, HORIZON_Y + 50);
        wet.addColorStop(0, "rgba(120, 140, 160, 0.35)");
        wet.addColorStop(1, "rgba(120, 140, 160, 0)");
        g.fillStyle = wet;
        g.fillRect(0, HORIZON_Y, WORLD.w, 50);
      } else {
        // 산 실루엣 3겹 (멀수록 밝고 흐림)
        const layers = [
          { y: HORIZON_Y - 95, amp: 55, color: "#3a2f4a", seed: 1 },
          { y: HORIZON_Y - 60, amp: 45, color: "#26203a", seed: 2 },
          { y: HORIZON_Y - 25, amp: 30, color: "#171422", seed: 3 },
        ];
        for (const L of layers) {
          g.fillStyle = L.color;
          g.beginPath();
          g.moveTo(0, HORIZON_Y);
          for (let x = 0; x <= WORLD.w; x += 10) {
            const y = L.y
              + Math.sin(x * 0.006 * L.seed + L.seed) * L.amp
              + Math.sin(x * 0.017 + L.seed * 3) * L.amp * 0.35
              + Math.sin(x * 0.05 + L.seed) * 4;
            g.lineTo(x, y);
          }
          g.lineTo(WORLD.w, HORIZON_Y);
          g.closePath();
          g.fill();
        }
        // 흙 + 풀
        g.fillStyle = "#17110c";
        g.fillRect(0, HORIZON_Y, WORLD.w, WORLD.h - HORIZON_Y);
        for (let i = 0; i < 6000; i++) {
          const x = Math.random() * WORLD.w, y = HORIZON_Y + Math.random() * (WORLD.h - HORIZON_Y);
          g.fillStyle = `rgba(${40 + Math.random() * 30}, ${28 + Math.random() * 18}, ${16 + Math.random() * 10}, ${0.25 + Math.random() * 0.4})`;
          g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
        }
        g.strokeStyle = "rgba(60, 80, 35, 0.35)";
        g.lineWidth = 1.2;
        for (let i = 0; i < 500; i++) {
          const x = Math.random() * WORLD.w, y = HORIZON_Y + Math.random() * (WORLD.h - HORIZON_Y);
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y - 5 - Math.random() * 6); g.stroke();
        }
        // 숲 가장자리 나무들
        for (let i = 0; i < 60; i++) {
          const x = (i / 60) * WORLD.w + (Math.random() - 0.5) * 20;
          const h = 28 + Math.random() * 30;
          g.fillStyle = `rgba(${10 + Math.random() * 8}, ${18 + Math.random() * 10}, ${12 + Math.random() * 6}, 0.95)`;
          g.beginPath(); g.moveTo(x - 10, HORIZON_Y + 4); g.lineTo(x, HORIZON_Y + 4 - h); g.lineTo(x + 10, HORIZON_Y + 4); g.closePath(); g.fill();
        }
      }
      this.groundCache = c;
    }
    ctx.drawImage(this.groundCache, 0, 0);
  }

  /** 매 프레임 움직이는 먼 풍경: 바다 물결, 산 반딧불 */
  private drawHorizonLive(ctx: CanvasRenderingContext2D, t: number) {
    if (this._kind === "sea") {
      const seaTop = HORIZON_Y - 70;
      ctx.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        const k = i / 8;
        const y0 = seaTop + 8 + k * k * 58;
        ctx.strokeStyle = `rgba(200, 220, 240, ${0.05 + k * 0.12})`;
        ctx.beginPath();
        for (let x = 0; x <= WORLD.w; x += 12) {
          const y = y0 + Math.sin(x * 0.02 + t * (0.6 + k) + i) * (1 + k * 3) + Math.sin(x * 0.007 - t * 0.4) * 2;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // 밀려오는 거품 선
      const foamY = HORIZON_Y - 2 + Math.sin(t * 0.5) * 5;
      ctx.strokeStyle = `rgba(230, 240, 250, ${0.25 + Math.sin(t * 0.5) * 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= WORLD.w; x += 10) {
        const y = foamY + Math.sin(x * 0.03 + t) * 3;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      // 반딧불 몇 마리
      for (let i = 0; i < 14; i++) {
        const x = (i * 97) % WORLD.w + Math.sin(t * 0.3 + i) * 30;
        const y = HORIZON_Y - 30 + Math.sin(t * 0.7 + i * 2) * 25;
        const a = (Math.sin(t * 1.3 + i * 1.7) + 1) / 2;
        ctx.fillStyle = `rgba(200, 255, 120, ${a * 0.7})`;
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  private drawSeats(ctx: CanvasRenderingContext2D) {
    const occupied = new Set<number>();
    for (const a of this.avatars.values()) if (a.state.seat !== null) occupied.add(a.state.seat);
    for (const s of SEATS) {
      if (occupied.has(s.id)) continue;
      const hover = this.hoverSeat?.id === s.id;
      // 통나무 의자
      ctx.save();
      ctx.translate(s.x, s.y + 6);
      ctx.fillStyle = hover ? "#6b4a2a" : "#4a3220";
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hover ? "#8a623a" : "#5e4128";
      ctx.beginPath(); ctx.ellipse(0, -5, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
      if (hover) {
        ctx.strokeStyle = "rgba(255, 200, 120, 0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, -5, 20, 11, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawBrazierBody(ctx: CanvasRenderingContext2D, x: number, y: number, size: "large" | "small") {
    ctx.save();
    ctx.translate(x, y);
    if (size === "large") {
      // 돌 둘레
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const rx = Math.cos(a) * 42, ry = Math.sin(a) * 26;
        ctx.fillStyle = i % 3 === 0 ? "#5a5047" : "#4a423a";
        ctx.beginPath(); ctx.ellipse(rx, ry, 9, 6, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#0e0905";
      ctx.beginPath(); ctx.ellipse(0, 0, 32, 18, 0, 0, Math.PI * 2); ctx.fill();
      // 장작
      ctx.fillStyle = "#3a2415";
      for (const r of [-0.4, 0.5, 0.05]) {
        ctx.save(); ctx.rotate(r);
        ctx.beginPath(); ctx.roundRect(-26, -5, 52, 10, 5); ctx.fill();
        ctx.restore();
      }
    } else {
      // 쇠 화로 (개인용)
      ctx.fillStyle = "#2a2622";
      ctx.beginPath(); ctx.ellipse(0, 10, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3b3530";
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0e0905";
      ctx.beginPath(); ctx.ellipse(0, -2, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3a2415";
      ctx.beginPath(); ctx.roundRect(-12, -5, 24, 6, 3); ctx.fill();
    }
    ctx.restore();
  }

  private drawAvatar(ctx: CanvasRenderingContext2D, a: Avatar, t: number) {
    const st = a.state;
    const seated = st.seat !== null;
    const self = st.id === this.selfId;
    const hue = st.hue;
    const bob = st.moving ? Math.abs(Math.sin(a.step)) * 3 : Math.sin(t * 1.5 + hue) * 0.8;
    // 나이: 10대는 조금 작고, 60대는 살짝 구부정
    const ageK = (st.age - 10) / 50; // 0~1
    const scale = st.age === 10 ? 0.88 : 1;
    const stoop = st.age >= 50 ? 2 : 0;
    const h = (seated ? 30 : 40) * scale;
    const hair = hairColor(st.age, hue);

    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, 2, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (self) {
      ctx.strokeStyle = "rgba(255, 220, 160, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 2, 17, 8, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // 몸 (여성은 아래가 살짝 퍼진 실루엣)
    const body = ctx.createLinearGradient(0, -h, 0, 0);
    body.addColorStop(0, `hsl(${hue}, 45%, 58%)`);
    body.addColorStop(1, `hsl(${hue}, 45%, 30%)`);
    ctx.fillStyle = body;
    ctx.beginPath();
    if (st.gender === "f") {
      ctx.moveTo(-9, -h + 10 - bob);
      ctx.lineTo(9, -h + 10 - bob);
      ctx.lineTo(12, 0);
      ctx.lineTo(-12, 0);
      ctx.closePath();
    } else {
      ctx.roundRect(-10, -h + 10 - bob, 20, h - 10, 6);
    }
    ctx.fill();
    // 머리
    const hy = -h - bob + 2 + stoop;
    ctx.fillStyle = `hsl(${hue}, 30%, 78%)`;
    ctx.beginPath(); ctx.arc(0, hy, 9 * scale, 0, Math.PI * 2); ctx.fill();
    // 머리카락: 여성은 길게, 남성은 짧게. 색은 나이대별
    ctx.fillStyle = hair;
    ctx.beginPath();
    if (st.gender === "f") {
      ctx.arc(0, hy - 1, 9.5 * scale, Math.PI, 0);
      ctx.lineTo(9.5 * scale, hy + 10);
      ctx.lineTo(-9.5 * scale, hy + 10);
      ctx.closePath();
      ctx.fill();
      // 얼굴을 다시 덮어 앞머리 아래 얼굴이 보이게
      ctx.fillStyle = `hsl(${hue}, 30%, 78%)`;
      ctx.beginPath(); ctx.arc(0, hy + 1, 7.5 * scale, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.arc(0, hy - 1, 9.3 * scale, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath();
      ctx.fill();
    }
    // 바라보는 방향(코)
    const fx = Math.cos(a.facing), fy = Math.sin(a.facing);
    ctx.fillStyle = `hsl(${hue}, 30%, 62%)`;
    ctx.beginPath(); ctx.arc(fx * 6 * scale, hy + 1 + fy * 3, 2.3, 0, Math.PI * 2); ctx.fill();
    // 40대 이상: 어깨에 담요/숄 느낌의 띠
    if (ageK >= 0.6) {
      ctx.fillStyle = `hsla(${(hue + 40) % 360}, 35%, 40%, 0.9)`;
      ctx.fillRect(-10, -h + 10 - bob, 20, 5);
    }
    ctx.restore();
  }

  private drawBurns(ctx: CanvasRenderingContext2D) {
    for (const b of this.burns) {
      const def = itemById(b.item);
      if (!def) continue;
      const k = Math.min(1, b.t / 0.75);
      const e = 1 - (1 - k) * (1 - k); // easeOut
      const x = b.fromX + (b.toX - b.fromX) * e;
      const y = b.fromY + (b.toY - b.fromY) * e - Math.sin(k * Math.PI) * 40;
      const fade = b.t > 0.75 ? Math.max(0, 1 - (b.t - 0.75) / 0.3) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x, y);
      ctx.rotate(Math.sin(b.t * 6) * 0.3);
      ctx.font = "22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.emoji, 0, 0);
      ctx.restore();
    }
  }

  private drawAshes(ctx: CanvasRenderingContext2D) {
    for (const a of this.ashes) {
      ctx.fillStyle = `rgba(120, 110, 100, ${Math.min(1, a.life) * 0.8})`;
      ctx.fillRect(a.x, a.y, a.size, a.size);
    }
  }

  private drawVignette(ctx: CanvasRenderingContext2D) {
    const g = ctx.createRadialGradient(WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.35, WORLD.w / 2, WORLD.h / 2, WORLD.w * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  }

  /** 월드 좌표 근처의 빈 자리 찾기 */
  seatNear(x: number, y: number, radius = 28): Seat | null {
    const occupied = new Set<number>();
    for (const a of this.avatars.values()) if (a.state.seat !== null && a.state.id !== this.selfId) occupied.add(a.state.seat);
    let best: Seat | null = null, bd = radius;
    for (const s of SEATS) {
      if (occupied.has(s.id)) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
}

function hairColor(age: number, hue: number) {
  if (age >= 60) return "#cfcac2";
  if (age >= 50) return "#8a8078";
  if (age >= 40) return "#3a2a22";
  if (age >= 30) return "#2a1c16";
  if (age >= 20) return `hsl(${(hue + 180) % 360}, 25%, 22%)`;
  return `hsl(${(hue + 180) % 360}, 45%, 35%)`; // 10대: 염색한 듯한 색
}

function angleDiff(from: number, to: number) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
