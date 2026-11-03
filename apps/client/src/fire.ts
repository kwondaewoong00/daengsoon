import { rand, type Scene } from "./scene";

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; hue: number;
}
interface Ember { x: number; y: number; vx: number; vy: number; life: number; }

/**
 * 모닥불 = 수백 개의 작은 "불씨 입자"가 아래에서 태어나 위로 올라가며 식어 사라지는 것.
 * 입자가 어릴 땐 노랗고 크고, 늙을수록 빨갛고 작아집니다. 이걸 겹쳐 그리면 불꽃처럼 보입니다.
 */
export class FireScene implements Scene {
  private w = 0; private h = 0;
  private particles: Particle[] = [];
  private embers: Ember[] = [];
  private flare = 0; // 장작 넣었을 때 잠깐 올라가는 보너스
  private spawnAcc = 0;

  resize(w: number, h: number) { this.w = w; this.h = h; }

  burst() { this.flare = 1; }

  draw(ctx: CanvasRenderingContext2D, t: number, dt: number, intensity: number) {
    const { w, h } = this;
    const power = Math.min(1, intensity + this.flare * 0.6);
    this.flare = Math.max(0, this.flare - dt * 0.8);

    // 배경: 아래가 은은하게 붉은 어둠
    ctx.globalCompositeOperation = "source-over";
    const bg = ctx.createRadialGradient(w / 2, h * 0.85, 10, w / 2, h * 0.85, Math.max(w, h) * 0.9);
    bg.addColorStop(0, `rgba(80, 30, 8, ${0.35 + power * 0.35})`);
    bg.addColorStop(1, "#0a0806");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 장작
    this.drawLogs(ctx, power);

    // 입자 태어나기: 세기가 클수록 많이, 넓게
    const base = { x: w / 2, y: h * 0.78 };
    const spread = 45 + power * 60;
    // 초당 180~420개. 누적(spawnAcc)으로 소수점 프레임도 빠짐없이 반영
    this.spawnAcc += (180 + power * 240) * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const off = (Math.random() - 0.5) * 2 * Math.sqrt(Math.random()); // 가운데가 촘촘하게
      this.particles.push({
        x: base.x + off * spread,
        y: base.y + rand(-8, 8),
        vx: -off * rand(10, 30) + Math.sin(t * 2 + off) * 6, // 위로 갈수록 중앙으로 모임 → 불꽃 모양
        vy: -rand(70, 150) * (0.6 + power),
        life: 0,
        maxLife: rand(0.6, 1.3) * (0.7 + power * 0.9) * (1 - Math.abs(off) * 0.45),
        size: rand(14, 30) * (0.7 + power * 0.6) * (1 - Math.abs(off) * 0.4),
        hue: rand(16, 44),
      });
    }
    if (Math.random() < 0.1 + power * 0.35) {
      this.embers.push({
        x: base.x + rand(-spread, spread) * 0.7, y: base.y - rand(0, 40),
        vx: rand(-20, 20), vy: -rand(50, 120), life: rand(1.5, 3.5),
      });
    }

    // 입자 그리기 (lighter: 겹칠수록 밝아짐 → 불의 중심이 하얗게)
    ctx.globalCompositeOperation = "lighter";
    const core = ctx.createRadialGradient(base.x, base.y - 30 * power, 0, base.x, base.y - 30 * power, 90 + power * 80);
    core.addColorStop(0, `rgba(255, 170, 60, ${0.25 + power * 0.3})`);
    core.addColorStop(1, "rgba(255, 90, 20, 0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, w, h);
    const wind = Math.sin(t * 0.7) * 10;
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      if (p.life >= p.maxLife) return false;
      const k = p.life / p.maxLife; // 0=태어남, 1=사라짐
      p.vx += (wind + Math.sin(t * 5 + p.y * 0.05) * 25) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const size = p.size * (1 - k * 0.8);
      const alpha = (1 - k) * 0.45;
      const light = 62 - k * 38;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
      g.addColorStop(0, `hsla(${p.hue - k * 15}, 100%, ${light}%, ${alpha})`);
      g.addColorStop(1, `hsla(${p.hue - k * 20}, 100%, 40%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    // 불똥
    this.embers = this.embers.filter((e) => {
      e.life -= dt;
      if (e.life <= 0) return false;
      e.vx += (wind * 2 + Math.sin(t * 7 + e.y * 0.1) * 60) * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      ctx.fillStyle = `hsla(35, 100%, 70%, ${Math.min(1, e.life)})`;
      ctx.fillRect(e.x, e.y, 2, 2);
      return true;
    });
    ctx.globalCompositeOperation = "source-over";
  }

  private drawLogs(ctx: CanvasRenderingContext2D, power: number) {
    const { w, h } = this;
    const cx = w / 2, cy = h * 0.8;
    ctx.save();
    ctx.translate(cx, cy);
    for (const [angle, len] of [[-0.35, 150], [0.4, 140], [0.05, 120]] as const) {
      ctx.save();
      ctx.rotate(angle);
      const g = ctx.createLinearGradient(0, -12, 0, 12);
      g.addColorStop(0, "#3a2415");
      g.addColorStop(0.5, `rgb(${70 + power * 60}, ${35 + power * 20}, 15)`);
      g.addColorStop(1, "#1a0f08");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(-len / 2, -11, len, 22, 10);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}
