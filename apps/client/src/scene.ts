/** 불이든 물이든 "장면"은 이 세 가지만 할 줄 알면 됩니다. 나중에 눈멍, 비멍을 추가할 때도 이 틀을 따릅니다. */
export interface Scene {
  resize(w: number, h: number, dpr: number): void;
  /** intensity: 0~1 (서버가 정해주는 세기), dt: 지난 프레임 이후 흐른 초 */
  draw(ctx: CanvasRenderingContext2D, t: number, dt: number, intensity: number): void;
  /** 누군가 장작을 넣었을 때 잠깐 확 타오르는 연출 */
  burst(): void;
}

export function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
