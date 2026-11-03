import { BRAZIERS, ITEMS, Room, SEATS, WORLD, parseProfile, roomName, type ClientMessage, type SceneKind, type ServerMessage } from "@daengsoon/shared";

/**
 * 체험판(서버 없음). 진짜 서버가 쓰는 Room 클래스를 브라우저 안에서 그대로 돌리고,
 * 봇 몇 명을 넣어 둡니다. 봇은 돌아다니다 앉고, 가끔 뭔가 태우고, 일어납니다.
 * RoomSocket 과 같은 모양(connect/send/close)이라 main.ts 는 차이를 모릅니다.
 */
interface Bot { id: string; phase: "wander" | "going" | "seated"; until: number; target?: number }

export class LocalServer {
  private room: Room;
  private bots: Bot[] = [];
  private timers: number[] = [];
  private selfId = "me";

  constructor(
    private kind: SceneKind,
    private profile: { g: string; a: string },
    private onMessage: (msg: ServerMessage) => void,
    private onStatus: (s: "connecting" | "open" | "closed") => void,
  ) {
    this.room = new Room(`${kind}-01`);
  }

  connect() {
    this.onStatus("connecting");
    const send = (msg: ServerMessage) => queueMicrotask(() => this.onMessage(msg));
    // 봇 먼저 들어와 있고
    const n = 5;
    for (let i = 0; i < n; i++) {
      const id = `bot${i}`;
      this.room.join({ id, send: () => {} }, parseProfile(Math.random() < 0.5 ? "f" : "m", String([10, 20, 30, 40, 50, 60][Math.floor(Math.random() * 6)])));
      this.bots.push({ id, phase: "wander", until: 0.5 + Math.random() * 3 });
    }
    // 내가 들어감
    this.room.join({ id: this.selfId, send }, parseProfile(this.profile.g, this.profile.a));
    this.onStatus("open");
    this.timers.push(
      window.setInterval(() => this.room.tick(Date.now()), 50),
      window.setInterval(() => this.room.flush(), 100),
      window.setInterval(() => this.think(), 500),
    );
  }

  send(msg: ClientMessage) {
    this.room.handle(this.selfId, msg);
  }

  close() {
    for (const t of this.timers) window.clearInterval(t);
    this.onStatus("closed");
  }

  /** 봇의 머리: 0.5초마다 한 번씩 생각함 */
  private think() {
    const now = performance.now() / 1000;
    for (const b of this.bots) {
      if (now < b.until) continue;
      const p = this.room.players.get(b.id);
      if (!p) continue;
      if (b.phase === "wander") {
        // 빈 자리 하나 골라서 걸어감 (사람 있는 화로를 선호)
        const taken = new Set([...this.room.players.values()].map((q) => q.state.seat).filter((s) => s !== null));
        const free = SEATS.filter((s) => !taken.has(s.id));
        if (free.length && Math.random() < 0.8) {
          const seat = free[Math.floor(Math.random() * free.length)];
          this.room.handle(b.id, { type: "sit", seat: seat.id });
          b.phase = "going"; b.target = seat.id; b.until = now + 12;
        } else {
          this.room.handle(b.id, { type: "move", x: 100 + Math.random() * (WORLD.w - 200), y: 300 + Math.random() * (WORLD.h - 400) });
          b.until = now + 3 + Math.random() * 4;
        }
      } else if (b.phase === "going") {
        if (p.state.seat !== null) { b.phase = "seated"; b.until = now + 8 + Math.random() * 25; }
        else if (now > b.until) { b.phase = "wander"; }
      } else if (b.phase === "seated") {
        if (Math.random() < 0.5) {
          const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
          this.room.handle(b.id, { type: "burn", item: item.id });
          b.until = now + 6 + Math.random() * 20;
        } else {
          this.room.handle(b.id, { type: "stand" });
          b.phase = "wander"; b.until = now + 2 + Math.random() * 3;
        }
      }
    }
  }

  static roomLabel(kind: SceneKind) {
    return roomName(`${kind}-01`);
  }
  static get braziers() {
    return BRAZIERS;
  }
}
