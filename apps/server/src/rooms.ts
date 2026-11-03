import { MAX_ROOMS, ROOM_CAPACITY, Room, makeRoomId, roomIdValid, roomKind, type RoomInfo, type SceneKind } from "@daengsoon/shared";

/**
 * RoomManager = 매표소. 방을 만들고, 빈자리 있는 방으로 안내합니다.
 * 방은 필요할 때 만들고, 비면 지웁니다.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();

  list(): RoomInfo[] {
    return [...this.rooms.values()].map((r) => r.info()).sort((a, b) => a.id.localeCompare(b.id));
  }

  get(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  /** ?room=camp-03 처럼 콕 집어 온 경우. 없으면 만들어 줌. 꽉 찼으면 undefined. */
  open(id: string): Room | undefined {
    if (!roomIdValid(id)) return undefined;
    let room = this.rooms.get(id);
    if (!room) {
      room = new Room(id);
      this.rooms.set(id, room);
    }
    return room.full ? undefined : room;
  }

  /**
   * 자동 배정: "사람이 가장 많지만 아직 자리 있는 방".
   * 같이 보는 게 핵심이므로 흩어지지 않게 한 방부터 채웁니다.
   */
  auto(kind: SceneKind): Room | undefined {
    let best: Room | undefined;
    for (const r of this.rooms.values()) {
      if (r.full || roomKind(r.id) !== kind) continue;
      if (!best || r.players.size > best.players.size) best = r;
    }
    if (best) return best;
    for (let n = 1; n <= MAX_ROOMS; n++) {
      const id = makeRoomId(kind, n);
      if (!this.rooms.has(id)) return this.open(id);
    }
    return undefined;
  }

  /** 아무도 없는 방 정리 */
  sweep() {
    for (const [id, r] of this.rooms) {
      if (r.players.size === 0) this.rooms.delete(id);
    }
  }

  tickAll(now: number) {
    for (const r of this.rooms.values()) r.tick(now);
  }
  flushAll() {
    for (const r of this.rooms.values()) r.flush();
  }

  static readonly capacity = ROOM_CAPACITY;
}
