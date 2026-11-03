import {
  DECAY_PER_SECOND,
  MAX_INTENSITY,
  MIN_INTENSITY,
  POKE_BOOST,
  type Mode,
  type RoomState,
} from "@daengsoon/shared";

/**
 * Room = 모닥불 하나.
 * 지금은 방이 하나뿐이지만, 나중에 "친구들끼리 방 만들기"를 하려면
 * 이 클래스를 여러 개 만들면 됩니다. 그래서 처음부터 클래스로 분리했습니다.
 */
export class Room {
  private mode: Mode = "fire";
  private intensity = 0.5;
  private totalPokes = 0;
  private viewers = 0;
  private lastTick = Date.now();

  snapshot(): RoomState {
    return {
      mode: this.mode,
      intensity: this.intensity,
      viewers: this.viewers,
      totalPokes: this.totalPokes,
    };
  }

  join(): void {
    this.viewers += 1;
  }

  leave(): void {
    this.viewers = Math.max(0, this.viewers - 1);
  }

  setMode(mode: Mode): boolean {
    if (this.mode === mode) return false;
    this.mode = mode;
    return true;
  }

  poke(): void {
    this.totalPokes += 1;
    this.intensity = Math.min(MAX_INTENSITY, this.intensity + POKE_BOOST);
  }

  /** 시간이 흐르면 장작이 타서 불이 서서히 작아진다. 변화가 있었으면 true. */
  tick(now = Date.now()): boolean {
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (this.intensity <= MIN_INTENSITY) return false;
    this.intensity = Math.max(MIN_INTENSITY, this.intensity - DECAY_PER_SECOND * dt);
    return true;
  }
}
