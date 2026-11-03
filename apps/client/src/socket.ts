import type { ClientMessage, RoomState, ServerMessage } from "@daengsoon/shared";

/**
 * 서버와의 "전화선".
 * HTTP는 편지(보내고 답장 기다림)라면, WebSocket은 전화(한 번 연결하면 양쪽이 아무 때나 말함)입니다.
 * 끊기면 자동으로 다시 걸고, 주기적으로 "여보세요?"(ping)를 보내 선이 살아있는지 확인합니다.
 */
export interface SocketEvents {
  state: (state: RoomState) => void;
  poke: (from: string) => void;
  connected: (selfId: string) => void;
  disconnected: () => void;
}

export class RoomSocket {
  private ws: WebSocket | null = null;
  private retryMs = 1000;
  private pingTimer: number | undefined;
  private listeners: Partial<SocketEvents> = {};
  selfId = "";

  on<K extends keyof SocketEvents>(ev: K, fn: SocketEvents[K]) {
    this.listeners[ev] = fn;
    return this;
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      this.retryMs = 1000;
      this.pingTimer = window.setInterval(() => this.send({ type: "ping" }), 15_000);
    };
    ws.onmessage = (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "welcome":
          this.selfId = msg.id;
          this.listeners.connected?.(msg.id);
          this.listeners.state?.(msg.state);
          break;
        case "state":
          this.listeners.state?.(msg.state);
          break;
        case "poke":
          this.listeners.poke?.(msg.from);
          break;
      }
    };
    ws.onclose = () => {
      window.clearInterval(this.pingTimer);
      this.listeners.disconnected?.();
      // 지수 백오프: 1초, 2초, 4초 … 최대 10초 간격으로 재시도
      window.setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(10_000, this.retryMs * 2);
    };
    ws.onerror = () => ws.close();
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
