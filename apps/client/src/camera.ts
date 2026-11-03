import { WORLD } from "@daengsoon/shared";

/**
 * 카메라 = "가상의 땅(월드)"을 화면에 어떻게 비출지.
 * 화면이 넓으면 방 전체를 보여주고, 폰처럼 좁으면 내 캐릭터를 따라다니며 확대합니다.
 */
export class Camera {
  scale = 1;
  x = 0; // 화면 왼쪽 위가 가리키는 월드 좌표
  y = 0;
  private viewW = 1;
  private viewH = 1;
  private followX = WORLD.w / 2;
  private followY = WORLD.h / 2;

  resize(w: number, h: number) {
    this.viewW = w;
    this.viewH = h;
    // 화면을 꽉 채우는 배율(검은 띠 없음). 방이 화면보다 크면 내 캐릭터를 따라다닙니다.
    const cover = Math.max(w / WORLD.w, h / WORLD.h);
    this.scale = Math.max(cover, 0.62);
    this.update(0);
  }

  follow(x: number, y: number) {
    this.followX = x;
    this.followY = y;
  }

  /** 부드럽게 따라가기 */
  update(dt: number) {
    const worldW = WORLD.w * this.scale, worldH = WORLD.h * this.scale;
    let tx: number, ty: number;
    if (worldW <= this.viewW) tx = -(this.viewW - worldW) / 2 / this.scale;
    else tx = clamp(this.followX - this.viewW / 2 / this.scale, 0, WORLD.w - this.viewW / this.scale);
    if (worldH <= this.viewH) ty = -(this.viewH - worldH) / 2 / this.scale;
    else ty = clamp(this.followY - this.viewH / 2 / this.scale, 0, WORLD.h - this.viewH / this.scale);
    const k = dt === 0 ? 1 : Math.min(1, dt * 4);
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
