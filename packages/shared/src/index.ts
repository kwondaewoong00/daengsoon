/**
 * 클라이언트(브라우저)와 서버가 "같은 언어"로 대화하기 위한 약속(프로토콜).
 * 양쪽이 이 파일을 함께 쓰기 때문에, 메시지 모양이 어긋나면 컴파일 단계에서 바로 잡힙니다.
 */

export type Mode = "fire" | "water";

/** 서버가 들고 있는 "진짜" 상태. 모든 접속자는 이 상태를 똑같이 봅니다. */
export interface RoomState {
  mode: Mode;
  /** 0~1. 불이면 장작의 세기, 물이면 물결의 세기 */
  intensity: number;
  /** 현재 접속 중인 사람 수 */
  viewers: number;
  /** 지금까지 넣은 장작(또는 던진 돌) 누적 수 */
  totalPokes: number;
}

/** 브라우저 → 서버 */
export type ClientMessage =
  | { type: "setMode"; mode: Mode }
  | { type: "poke" } // 장작 넣기 / 돌 던지기
  | { type: "ping" };

/** 서버 → 브라우저 */
export type ServerMessage =
  | { type: "welcome"; id: string; state: RoomState }
  | { type: "state"; state: RoomState }
  | { type: "poke"; from: string; at: number }
  | { type: "pong" };

export const MAX_INTENSITY = 1;
export const MIN_INTENSITY = 0.15;
/** 장작 하나가 더해주는 세기 */
export const POKE_BOOST = 0.18;
/** 초당 자연 감소량 (장작은 타서 사그라든다) */
export const DECAY_PER_SECOND = 0.006; // 장작 하나가 약 30초 동안 탄다
