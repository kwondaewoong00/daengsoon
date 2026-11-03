/**
 * 브라우저와 서버가 함께 쓰는 "규칙서".
 * - 방 배치(화로 위치, 자리 위치)는 여기서 한 번만 정의합니다. 양쪽이 같은 좌표를 봅니다.
 * - 메시지 모양도 여기서 정의합니다. 어긋나면 컴파일 단계에서 잡힙니다.
 */

// ---------- 월드 ----------
/** 방의 크기(월드 좌표). 화면 크기와 무관한 "가상의 땅" 단위입니다. */
export const WORLD = { w: 1400, h: 900 } as const;
export const ROOM_CAPACITY = 20;
export const MAX_ROOMS = 50;
/** 캐릭터 걷는 속도 (월드 단위/초) */
export const WALK_SPEED = 170;
/** 자리에 이 거리 안으로 오면 "앉음" 처리 */
export const SEAT_SNAP = 6;
/** 태우기 쿨다운(ms) */
export const BURN_COOLDOWN_MS = 2500;

export interface Vec2 { x: number; y: number }

export interface Seat {
  id: number;
  brazier: number;
  x: number;
  y: number;
  /** 앉았을 때 바라보는 각도(라디안). 화로 쪽을 봅니다. */
  facing: number;
}

export interface Brazier {
  id: number;
  x: number;
  y: number;
  size: "large" | "small";
  seats: Seat[];
}

function makeBrazier(id: number, x: number, y: number, size: "large" | "small", seatIdStart: number): Brazier {
  const seats: Seat[] = [];
  if (size === "large") {
    // 4인 화로: 동서남북에 하나씩
    const r = 78;
    const angles = [Math.PI / 2, Math.PI, -Math.PI / 2, 0]; // 남, 서, 북, 동
    angles.forEach((a, i) => {
      seats.push({ id: seatIdStart + i, brazier: id, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, facing: a + Math.PI });
    });
  } else {
    // 1인 화로: 남쪽에 하나
    seats.push({ id: seatIdStart, brazier: id, x, y: y + 52, facing: -Math.PI / 2 });
  }
  return { id, x, y, size, seats };
}

/** 한 방 = 4인 화로 4개 + 1인 화로 4개 = 20석 */
export const BRAZIERS: readonly Brazier[] = (() => {
  const list: Brazier[] = [];
  let seat = 0;
  const large: Array<[number, number]> = [[380, 300], [1020, 300], [380, 620], [1020, 620]];
  const small: Array<[number, number]> = [[700, 160], [130, 460], [1270, 460], [700, 740]];
  large.forEach(([x, y], i) => { list.push(makeBrazier(i, x, y, "large", seat)); seat += 4; });
  small.forEach(([x, y], i) => { list.push(makeBrazier(4 + i, x, y, "small", seat)); seat += 1; });
  return list;
})();

export const SEATS: readonly Seat[] = BRAZIERS.flatMap((b) => b.seats);
export function seatById(id: number): Seat | undefined {
  return SEATS[id];
}

// ---------- 태울 것들 ----------
export type ItemId = "report" | "resignation" | "letter" | "receipt" | "exam" | "diary";
export interface ItemDef { id: ItemId; label: string; emoji: string; /** 불꽃 색 */ flash: string; line: string }
export const ITEMS: readonly ItemDef[] = [
  { id: "report", label: "보고서", emoji: "📄", flash: "#ffd27a", line: "보고서가 재가 되었어요" },
  { id: "resignation", label: "사직서", emoji: "📝", flash: "#fff5e0", line: "사직서가 활활 탔어요" },
  { id: "letter", label: "편지", emoji: "💌", flash: "#ff9fb8", line: "편지가 조용히 타올랐어요" },
  { id: "receipt", label: "영수증", emoji: "🧾", flash: "#b8f0ff", line: "영수증이 사라졌어요" },
  { id: "exam", label: "시험지", emoji: "📋", flash: "#c8ff9a", line: "시험지가 불길에 휩싸였어요" },
  { id: "diary", label: "일기장", emoji: "📔", flash: "#d9b8ff", line: "일기장이 연기가 되었어요" },
];
export function itemById(id: string): ItemDef | undefined {
  return ITEMS.find((i) => i.id === id);
}

// ---------- 상태 ----------
export interface PlayerState {
  id: string;
  x: number;
  y: number;
  /** 0~360. 캐릭터 색 */
  hue: number;
  /** 앉은 자리. 서 있으면 null */
  seat: number | null;
  /** 걷는 중인지 (애니메이션용) */
  moving: boolean;
  /** 바라보는 방향(라디안) */
  facing: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  count: number;
  capacity: number;
}

// ---------- 메시지 ----------
/** 브라우저 → 서버 */
export type ClientMessage =
  | { type: "move"; x: number; y: number }   // 여기로 걸어가고 싶어요
  | { type: "sit"; seat: number }            // 이 자리에 앉고 싶어요 (걸어가서 앉음)
  | { type: "stand" }
  | { type: "burn"; item: ItemId }
  | { type: "ping" };

/** 서버 → 브라우저 */
export type ServerMessage =
  | { type: "welcome"; id: string; room: RoomInfo; players: PlayerState[] }      // 스냅샷
  | { type: "update"; players: Array<Partial<PlayerState> & { id: string }> }  // 델타: 바뀐 사람만
  | { type: "join"; player: PlayerState }
  | { type: "leave"; id: string }
  | { type: "room"; room: RoomInfo }
  | { type: "burn"; id: string; seat: number; item: ItemId; at: number }
  | { type: "denied"; reason: "seat-taken" | "not-seated" | "cooldown" }
  | { type: "full"; rooms: RoomInfo[] }
  | { type: "pong" };

export function roomIdValid(id: string): boolean {
  return /^camp-\d{2}$/.test(id) && Number(id.slice(5)) >= 1 && Number(id.slice(5)) <= MAX_ROOMS;
}
export function roomName(id: string): string {
  return `${Number(id.slice(5))}번 캠프`;
}
