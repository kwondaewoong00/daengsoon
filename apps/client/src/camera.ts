import { WORLD } from "@daengsoon/shared";

/**
 * 카메라 = "가상의 땅(월드)"을 화면에 어떻게 비출지.
 * - 걸어다닐 때: 내 캐릭터를 따라다니며 캠프를 넓게 보여줍니다.
 * - 앉았을 때: 그 화로로 쑥 들어가서 불과 같이 앉은 사람들만 크게 보여줍니다(폰 세로 기준).
 * 둘 사이는 부드럽게 넘어갑니다(배율과 위치 모두 lerp).
 */
export class Camera {
  scale = 1;
  x = 0; // 화면 왼쪽 위가 가리키는 월드 좌표
  y = 0;
  private viewW = 1;
  private viewH = 1;
  private baseScale = 1;
  private followX = WORLD.w / 2;
  private followY = WORLD.h / 2;
  /** 앉은 화로. 있으면 그곳을 확대 */
  private focus: { x: number; y: number; width: number } | null = null;
  private snap = true;

  resize(w: number, h: number) {
    this.viewW = w;
    this.viewH = h;
    // 화면을 꽉 채우는 배율(검은 띠 없음). 방이 화면보다 크면 내 캐릭터를 따라다닙니다.
    const cover = Math.max(w / WORLD.w, h / WORLD.h);
    this.baseScale = Math.max(cover, 0.62);
    this.snap = true;
    this.update(0);
  }

  follow(x: number, y: number) {
    this.followX = x;
    this.followY = y;
  }

  /** 화로 하나에 집중. width = 화면 가로에 담고 싶은 월드 너비 */
  focusOn(x: number, y: number, width: number) {
    this.focus = { x, y, width };
  }
  clearFocus() {
    this.focus = null;
  }
  get focused() {
    return this.focus !== null;
  }

  private desiredScale() {
    if (!this.focus) return this.baseScale;
    const byW = this.viewW / this.focus.width;
    const byH = this.viewH / (this.focus.width * 1.15);
    return Math.max(1.25, Math.min(2.6, Math.min(byW, byH)));
  }

  update(dt: number) {
    const k = this.snap || dt === 0 ? 1 : Math.min(1, dt * 3.5);
    this.snap = false;
    const s = this.desiredScale();
    this.scale += (s - this.scale) * k;

    let tx: number, ty: number;
    if (this.focus) {
      // 화로를 가로 중앙, 세로는 중앙보다 살짝 아래(불꽃이 위로 올라갈 공간)
      tx = this.focus.x - this.viewW / 2 / this.scale;
      ty = this.focus.y - (this.viewH * 0.52) / this.scale;
    } else {
      const worldW = WORLD.w * this.scale, worldH = WORLD.h * this.scale;
      if (worldW <= this.viewW) tx = -(this.viewW - worldW) / 2 / this.scale;
      else tx = clamp(this.followX - this.viewW / 2 / this.scale, 0, WORLD.w - this.viewW / this.scale);
      if (worldH <= this.viewH) ty = -(this.viewH - worldH) / 2 / this.scale;
      else ty = clamp(this.followY - this.viewH / 2 / this.scale, 0, WORLD.h - this.viewH / this.scale);
    }
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
  }

  toWorld(sx: number, sy: number) {
    return { x: sx / this.scale + this.x, y: sy / this.scale + this.y };
  }

  apply(ctx: CanvasRenderingContext2D) {
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.x, -this.y);
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
