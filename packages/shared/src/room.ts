import {
  BURN_COOLDOWN_MS,
  ROOM_CAPACITY,
  SEAT_SNAP,
  WALK_SPEED,
  WORLD,
  HORIZON_Y,
  itemById,
  randomNick,
  roomKind,
  roomName,
  type Profile,
  seatById,
  type ClientMessage,
  type PlayerState,
  type RoomInfo,
  type ServerMessage,
} from "./protocol";

export interface Client {
  id: string;
  send(msg: ServerMessage): void;
}

interface Player {
  state: PlayerState;
  /** 걸어가는 목적지. 없으면 멈춤 */
  target: { x: number; y: number } | null;
  /** 앉으려고 걸어가는 중인 자리 */
  reservedSeat: number | null;
  lastBurnAt: number;
  client: Client;
}

/**
 * Room = 캠프 하나. 화로 8개, 정원 20명.
 * 이 클래스는 바깥 세상(WebSocket, HTTP)을 전혀 모릅니다. 메시지를 받고(handle) 사람들에게 보낼 뿐(client.send).
 * 그래서 나중에 서버를 Cloudflare Durable Objects 같은 곳으로 옮겨도 이 파일은 그대로 씁니다.
 */
export class Room {
  readonly players = new Map<string, Player>();
  /** 이번 틱에 바뀐 사람들 — 델타로 묶어 보냄 */
  private dirty = new Set<string>();
  private lastTick = Date.now();

  constructor(readonly id: string) {}

  info(): RoomInfo {
    return { id: this.id, kind: roomKind(this.id), name: roomName(this.id), count: this.players.size, capacity: ROOM_CAPACITY };
  }

  get full() {
    return this.players.size >= ROOM_CAPACITY;
  }

  private seatTakenBy(seat: number): Player | undefined {
    for (const p of this.players.values()) {
      if (p.state.seat === seat || p.reservedSeat === seat) return p;
    }
    return undefined;
  }

  join(client: Client, profile: Profile): PlayerState {
    // 입구(아래쪽 가운데)에 살짝 흩어져서 등장
    const state: PlayerState = {
      id: client.id,
      name: randomNick(),
      gender: profile.gender,
      age: profile.age,
      x: WORLD.w / 2 + (Math.random() - 0.5) * 160,
      y: WORLD.h - 60 - Math.random() * 40,
      hue: Math.floor(Math.random() * 360),
      seat: null,
      moving: false,
      facing: -Math.PI / 2,
    };
    const player: Player = { state, target: null, reservedSeat: null, lastBurnAt: 0, client };
    this.players.set(client.id, player);

    client.send({
      type: "welcome",
      id: client.id,
      room: this.info(),
      players: [...this.players.values()].map((p) => p.state),
    });
    this.broadcast({ type: "join", player: state }, client.id);
    this.broadcast({ type: "room", room: this.info() });
    return state;
  }

  leave(id: string) {
    if (!this.players.delete(id)) return;
    this.dirty.delete(id);
    this.broadcast({ type: "leave", id });
    this.broadcast({ type: "room", room: this.info() });
  }

  handle(id: string, msg: ClientMessage) {
    const p = this.players.get(id);
    if (!p) return;
    switch (msg.type) {
      case "move": {
        if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y)) return;
        p.target = { x: clamp(msg.x, 20, WORLD.w - 20), y: clamp(msg.y, HORIZON_Y + 20, WORLD.h - 20) };
        p.reservedSeat = null;
        if (p.state.seat !== null) {
          p.state.seat = null;
          this.dirty.add(id);
        }
        break;
      }
      case "sit": {
        const seat = seatById(msg.seat);
        if (!seat) return;
        const taken = this.seatTakenBy(seat.id);
        if (taken && taken !== p) {
          p.client.send({ type: "denied", reason: "seat-taken" });
          return;
        }
        if (p.state.seat !== null) {
          p.state.seat = null;
          this.dirty.add(id);
        }
        p.reservedSeat = seat.id;
        p.target = { x: seat.x, y: seat.y };
        break;
      }
      case "stand": {
        if (p.state.seat === null && p.reservedSeat === null) return;
        const seat = p.state.seat !== null ? seatById(p.state.seat) : null;
        p.state.seat = null;
        p.reservedSeat = null;
        // 일어나면 화로 반대쪽으로 한 걸음
        if (seat) {
          p.target = {
            x: clamp(seat.x - Math.cos(seat.facing) * 40, 20, WORLD.w - 20),
            y: clamp(seat.y - Math.sin(seat.facing) * 40, HORIZON_Y + 20, WORLD.h - 20),
          };
        }
        this.dirty.add(id);
        break;
      }
      case "burn": {
        if (p.state.seat === null) {
          p.client.send({ type: "denied", reason: "not-seated" });
          return;
        }
        if (!itemById(msg.item)) return;
        const now = Date.now();
        if (now - p.lastBurnAt < BURN_COOLDOWN_MS) {
          p.client.send({ type: "denied", reason: "cooldown" });
          return;
        }
        p.lastBurnAt = now;
        // 불 세기는 그대로. 순간적인 연출만 모두에게.
        this.broadcast({ type: "burn", id, seat: p.state.seat, item: msg.item, at: now });
        break;
      }
      case "ping":
        p.client.send({ type: "pong" });
        break;
    }
  }

  /** 시뮬레이션 한 걸음: 걷기, 도착하면 앉기. 20Hz로 호출. */
  tick(now = Date.now()) {
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;

    for (const [id, p] of this.players) {
      if (!p.target) continue;
      const s = p.state;
      const dx = p.target.x - s.x, dy = p.target.y - s.y;
      const dist = Math.hypot(dx, dy);
      const step = WALK_SPEED * dt;

      if (dist <= Math.max(step, SEAT_SNAP)) {
        s.x = p.target.x;
        s.y = p.target.y;
        s.moving = false;
        p.target = null;
        if (p.reservedSeat !== null) {
          const seat = seatById(p.reservedSeat);
          if (seat && (this.seatTakenBy(seat.id) ?? p) === p) {
            s.seat = seat.id;
            s.facing = seat.facing;
          }
          p.reservedSeat = null;
        }
      } else {
        s.x += (dx / dist) * step;
        s.y += (dy / dist) * step;
        s.moving = true;
        s.facing = Math.atan2(dy, dx);
      }
      this.dirty.add(id);
    }
  }

  /** 바뀐 사람만 묶어서 보냄(델타). 10Hz로 호출. */
  flush() {
    if (this.dirty.size === 0) return;
    const players = [];
    for (const id of this.dirty) {
      const p = this.players.get(id);
      if (!p) continue;
      const { x, y, seat, moving, facing } = p.state;
      players.push({ id, x: round(x), y: round(y), seat, moving, facing: round(facing) });
    }
    this.dirty.clear();
    if (players.length) this.broadcast({ type: "update", players });
  }

  broadcast(msg: ServerMessage, except?: string) {
    for (const p of this.players.values()) {
      if (p.client.id !== except) p.client.send(msg);
    }
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function round(v: number) {
  return Math.round(v * 10) / 10;
}
