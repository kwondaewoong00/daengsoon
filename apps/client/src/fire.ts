import type { Brazier } from "@daengsoon/shared";

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number }
interface Ember { x: number; y: number; vx: number; vy: number; life: number }

/**
 * 화로 하나의 불. 수백 개의 불씨 입자가 아래에서 태어나 위로 올라가며 식어 사라집니다.
 * 어릴 땐 노랗고 크게, 늙을수록 빨갛고 작게. 겹쳐 그리면 불꽃이 됩니다.
 * burn()이 호출되면 잠깐 색이 바뀌고 확 타오릅니다(세기는 원래대로 돌아옴).
 */
export class FirePit {
  private particles: Particle[] = [];
  private embers: Ember[] = [];
  private acc = 0;
  private flash = 0;
  private flashColor = "#fff";
  readonly scale: number;

  constructor(readonly brazier: Brazier) {
    this.scale = brazier.size === "large" ? 1 : 0.55;
  }

  burn(color: string) {
    this.flash = 1;
    this.flashColor = color;
  }

  update(dt: number, t: number) {
    const { x, y } = this.brazier;
    const s = this.scale;
    const power = 0.55 + this.flash * 0.9;
    this.flash = Math.max(0, this.flash - dt * 0.7);

    this.acc += (160 + this.flash * 260) * s * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      const off = (Math.random() - 0.5) * 2 * Math.sqrt(Math.random());
      const spread = 26 * s;
      this.particles.push({
        x: x + off * spread,
        y: y - 4 * s + (Math.random() - 0.5) * 6,
        vx: -off * (8 + Math.random() * 14) + Math.sin(t * 2 + off) * 4,
        vy: -(50 + Math.random() * 60) * s * (0.7 + power * 0.5),
        life: 0,
        max: (0.5 + Math.random() * 0.6) * (0.8 + power * 0.5) * (1 - Math.abs(off) * 0.45),
        size: (9 + Math.random() * 11) * s * (1 - Math.abs(off) * 0.4),
        hue: 16 + Math.random() * 28,
      });
    }
    if (Math.random() < (0.08 + this.flash * 0.6) * s) {
      this.embers.push({ x: x + (Math.random() - 0.5) * 30 * s, y: y - 10, vx: (Math.random() - 0.5) * 30, vy: -(40 + Math.random() * 70), life: 1.5 + Math.random() * 2 });
    }
    const wind = Math.sin(t * 0.7) * 6;
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      if (p.life >= p.max) return false;
      p.vx += (wind + Math.sin(t * 5 + p.y * 0.05) * 18) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return true;
    });
    this.embers = this.embers.filter((e) => {
      e.life -= dt;
      if (e.life <= 0) return false;
      e.vx += (wind * 2 + Math.sin(t * 7 + e.y * 0.1) * 40) * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      return true;
    });
  }

  /** 바닥에 깔리는 빛. 캐릭터보다 먼저 그립니다. */
  drawGlow(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.brazier;
    const r = (110 + this.flash * 60) * this.scale + 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 150, 60, ${0.28 + this.flash * 0.25})`);
    g.addColorStop(1, "rgba(255, 90, 20, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /** 불꽃 본체. 캐릭터와 함께 y 순서로 그립니다. */
  drawFlames(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.brazier;
    const s = this.scale;
    ctx.globalCompositeOperation = "lighter";
    const core = ctx.createRadialGradient(x, y - 18 * s, 0, x, y - 18 * s, (50 + this.flash * 40) * s);
    core.addColorStop(0, `rgba(255, 170, 60, ${0.3 + this.flash * 0.3})`);
    core.addColorStop(1, "rgba(255, 90, 20, 0)");
    ctx.fillStyle = core;
    ctx.fillRect(x - 100, y - 120, 200, 160);

    for (const p of this.particles) {
      const k = p.life / p.max;
      const size = p.size * (1 - k * 0.8);
      const alpha = (1 - k) * 0.45;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
      if (this.flash > 0.05 && k < 0.5) {
        g.addColorStop(0, hexA(this.flashColor, alpha * this.flash * 1.2));
        g.addColorStop(1, `hsla(${p.hue}, 100%, 40%, 0)`);
      } else {
        g.addColorStop(0, `hsla(${p.hue - k * 15}, 100%, ${62 - k * 38}%, ${alpha})`);
        g.addColorStop(1, `hsla(${p.hue - k * 20}, 100%, 40%, 0)`);
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of this.embers) {
      ctx.fillStyle = `hsla(35, 100%, 70%, ${Math.min(1, e.life)})`;
      ctx.fillRect(e.x, e.y, 2, 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
}
