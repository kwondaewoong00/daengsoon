/**
 * 브라우저와 서버가 함께 쓰는 "규칙서".
 * - 방 배치(화로 위치, 자리 위치)는 여기서 한 번만 정의합니다. 양쪽이 같은 좌표를 봅니다.
 * - 메시지 모양도 여기서 정의합니다. 어긋나면 컴파일 단계에서 잡힙니다.
 */

// ---------- 월드 ----------
/** 방의 크기(월드 좌표). 화면 크기와 무관한 "가상의 땅" 단위입니다. */
export const WORLD = { w: 1400, h: 1000 } as const;
/** 이 y 위로는 먼 풍경(하늘·산·바다). 캐릭터는 이 아래 땅에서만 움직입니다. */
export const HORIZON_Y = 190;
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
  const large: Array<[number, number]> = [[380, 420], [1020, 420], [380, 740], [1020, 740]];
  const small: Array<[number, number]> = [[700, 290], [130, 580], [1270, 580], [700, 860]];
  large.forEach(([x, y], i) => { list.push(makeBrazier(i, x, y, "large", seat)); seat += 4; });
  small.forEach(([x, y], i) => { list.push(makeBrazier(4 + i, x, y, "small", seat)); seat += 1; });
  return list;
})();

export const SEATS: readonly Seat[] = BRAZIERS.flatMap((b) => b.seats);
export function seatById(id: number): Seat | undefined {
  return SEATS[id];
}

// ---------- 누구신가요 ----------
export type Gender = "m" | "f";
export type AgeBand = 10 | 20 | 30 | 40 | 50 | 60;
export const AGE_BANDS: readonly AgeBand[] = [10, 20, 30, 40, 50, 60];
export interface Profile { gender: Gender; age: AgeBand }
export function parseProfile(g: string | null, a: string | null): Profile {
  const gender: Gender = g === "f" ? "f" : "m";
  const n = Number(a);
  const age = (AGE_BANDS as readonly number[]).includes(n) ? (n as AgeBand) : 20;
  return { gender, age };
}

// ---------- 이름표 ----------
export const NICK_ADJ = ["다정한", "조용한", "느긋한", "졸린", "따뜻한", "수줍은", "씩씩한", "포근한", "말없는", "나른한", "반짝이는", "어슬렁대는", "흐뭇한", "심심한", "홀가분한", "촉촉한"];
export const NICK_NOUN = ["이끼", "솔방울", "조약돌", "파도", "장작", "반딧불", "낙엽", "모래알", "달빛", "도토리", "갈대", "별똥별", "나뭇잎", "연기", "물결", "고구마"];
export function randomNick(rand = Math.random): string {
  return `${NICK_ADJ[Math.floor(rand() * NICK_ADJ.length)]} ${NICK_NOUN[Math.floor(rand() * NICK_NOUN.length)]}`;
}

// ---------- 캠프 종류 ----------
export type SceneKind = "mountain" | "sea";
export const SCENES: Record<SceneKind, { label: string; emoji: string }> = {
  mountain: { label: "산", emoji: "🏔️" },
  sea: { label: "바다", emoji: "🌊" },
};

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
  /** 서버가 지어주는 이름표. 예: "다정한 이끼" */
  name: string;
  gender: Gender;
  age: AgeBand;
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
  kind: SceneKind;
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

/** 방 id = 종류-번호. 예: mountain-01, sea-03 */
export function roomIdValid(id: string): boolean {
  const m = /^(mountain|sea)-(\d{2})$/.exec(id);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= MAX_ROOMS;
}
export function roomKind(id: string): SceneKind {
  return id.startsWith("sea-") ? "sea" : "mountain";
}
export function roomNumber(id: string): number {
  return Number(id.slice(id.indexOf("-") + 1));
}
export function roomName(id: string): string {
  return `${SCENES[roomKind(id)].label} ${roomNumber(id)}번 캠프`;
}
export function makeRoomId(kind: SceneKind, n: number): string {
  return `${kind}-${String(n).padStart(2, "0")}`;
}
