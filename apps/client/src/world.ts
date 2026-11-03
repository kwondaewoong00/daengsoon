import { BRAZIERS, SEATS, WORLD, itemById, seatById, type ItemId, type PlayerState, type Seat } from "@daengsoon/shared";
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
  selfId = "";
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
  private drawGround(ctx: CanvasRenderingContext2D) {
    if (!this.groundCache) {
      const c = document.createElement("canvas");
      c.width = WORLD.w; c.height = WORLD.h;
      const g = c.getContext("2d")!;
      g.fillStyle = "#17110c";
      g.fillRect(0, 0, WORLD.w, WORLD.h);
      // 흙 질감: 작은 점들
      for (let i = 0; i < 6000; i++) {
        const x = Math.random() * WORLD.w, y = Math.random() * WORLD.h;
        g.fillStyle = `rgba(${40 + Math.random() * 30}, ${28 + Math.random() * 18}, ${16 + Math.random() * 10}, ${0.25 + Math.random() * 0.4})`;
        g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
      // 풀 몇 포기
      g.strokeStyle = "rgba(60, 80, 35, 0.35)";
      g.lineWidth = 1.2;
      for (let i = 0; i < 400; i++) {
        const x = Math.random() * WORLD.w, y = Math.random() * WORLD.h;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 6, y - 5 - Math.random() * 6); g.stroke();
      }
      this.groundCache = c;
    }
    ctx.drawImage(this.groundCache, 0, 0);
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
    const seated = a.state.seat !== null;
    const self = a.state.id === this.selfId;
    const hue = a.state.hue;
    const bob = a.state.moving ? Math.abs(Math.sin(a.step)) * 3 : Math.sin(t * 1.5 + hue) * 0.8;
    const h = seated ? 30 : 40; // 앉으면 낮아짐

    ctx.save();
    ctx.translate(a.x, a.y);
    // 그림자
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, 2, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    if (self) {
      ctx.strokeStyle = "rgba(255, 220, 160, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 2, 17, 8, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // 몸
    const body = ctx.createLinearGradient(0, -h, 0, 0);
    body.addColorStop(0, `hsl(${hue}, 45%, 58%)`);
    body.addColorStop(1, `hsl(${hue}, 45%, 30%)`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-10, -h + 10 - bob, 20, h - 10, 8);
    ctx.fill();
    // 머리
    ctx.fillStyle = `hsl(${hue}, 30%, 78%)`;
    ctx.beginPath(); ctx.arc(0, -h - bob + 2, 9, 0, Math.PI * 2); ctx.fill();
    // 바라보는 방향(코)
    const fx = Math.cos(a.facing), fy = Math.sin(a.facing);
    ctx.fillStyle = `hsl(${hue}, 30%, 62%)`;
    ctx.beginPath(); ctx.arc(fx * 6, -h - bob + 2 + fy * 3, 2.5, 0, Math.PI * 2); ctx.fill();
    // 불빛 받는 쪽 하이라이트 (가까운 화로 방향)
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

function angleDiff(from: number, to: number) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
