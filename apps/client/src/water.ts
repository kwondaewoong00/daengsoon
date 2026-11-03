import { rand, type Scene } from "./scene";

interface Ripple { x: number; y: number; r: number; maxR: number; life: number; }

/**
 * 물 = 여러 개의 사인파(부드러운 물결)를 겹친 것 + 가끔 생기는 동심원(파문).
 * 사인파 하나는 심심하지만 속도·크기가 다른 파를 3~4개 겹치면 자연스러운 수면이 됩니다.
 */
export class WaterScene implements Scene {
  private w = 0; private h = 0;
  private ripples: Ripple[] = [];
  private splash = 0;

  resize(w: number, h: number) { this.w = w; this.h = h; }

  burst() {
    this.splash = 1;
    this.ripples.push({ x: this.w / 2 + rand(-80, 80), y: this.h * 0.6 + rand(-30, 30), r: 0, maxR: 220, life: 1 });
  }

  draw(ctx: CanvasRenderingContext2D, t: number, dt: number, intensity: number) {
    const { w, h } = this;
    const power = Math.min(1, intensity + this.splash * 0.4);
    this.splash = Math.max(0, this.splash - dt * 0.5);

    ctx.globalCompositeOperation = "source-over";
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#04101a");
    sky.addColorStop(0.45, "#0a2238");
    sky.addColorStop(1, "#061826");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // 달 + 수면에 비친 달빛 (가장자리가 부드러운 타원)
    const moonX = w * 0.5, moonY = h * 0.18;
    const moon = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 70);
    moon.addColorStop(0, "rgba(235, 245, 255, 0.95)");
    moon.addColorStop(0.3, "rgba(220, 238, 255, 0.6)");
    moon.addColorStop(1, "rgba(180, 220, 255, 0)");
    ctx.fillStyle = moon;
    ctx.fillRect(moonX - 80, moonY - 80, 160, 160);
    ctx.save();
    ctx.translate(moonX, h * 0.72);
    ctx.scale(1, 3.2);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
    glow.addColorStop(0, "rgba(170, 215, 255, 0.22)");
    glow.addColorStop(1, "rgba(170, 215, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-90, -90, 180, 180);
    ctx.restore();

    // 물결 띠: 아래로 갈수록 가까워져서 크고 느리게
    const horizon = h * 0.42;
    const bands = 18;
    for (let i = 0; i < bands; i++) {
      const k = i / (bands - 1);
      const y0 = horizon + k * k * (h - horizon);
      const amp = (2 + k * 10) * (0.5 + power);
      const speed = 0.6 + k * 0.6;
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 8) {
        const y =
          y0 +
          Math.sin(x * 0.012 + t * speed + i) * amp +
          Math.sin(x * 0.03 - t * speed * 1.7 + i * 2) * amp * 0.5 +
          Math.sin(x * 0.005 + t * 0.3) * amp * 0.8;
        if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 10, h + 10);
      ctx.lineTo(-10, h + 10);
      ctx.closePath();
      const near = Math.abs(((w / 2) - moonX) / w);
      ctx.fillStyle = `rgba(${10 + k * 20}, ${40 + k * 40}, ${70 + k * 60 - near * 20}, ${0.25 + k * 0.08})`;
      ctx.fill();
      // 물결 위 하이라이트
      ctx.strokeStyle = `rgba(190, 230, 255, ${0.04 + k * 0.08 * power})`;
      ctx.lineWidth = 1 + k;
      ctx.stroke();
    }

    // 파문
    if (Math.random() < 0.02 + power * 0.04) {
      this.ripples.push({ x: rand(0, w), y: rand(horizon + 40, h - 20), r: 0, maxR: rand(60, 160), life: 1 });
    }
    ctx.lineWidth = 1.2;
    this.ripples = this.ripples.filter((r) => {
      r.life -= dt * 0.35;
      if (r.life <= 0) return false;
      r.r += dt * 40;
      const depth = (r.y - horizon) / (h - horizon); // 멀수록 납작하게
      for (let ring = 0; ring < 3; ring++) {
        const rr = r.r - ring * 14;
        if (rr <= 0) continue;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rr, rr * (0.15 + depth * 0.25), 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200, 235, 255, ${r.life * 0.35 * (1 - ring * 0.3)})`;
        ctx.stroke();
      }
      return true;
    });
  }
}
