import type { ClientMessage, ServerMessage } from "@daengsoon/shared";

/**
 * 서버와의 전화선. 끊기면 다시 걸고(지수 백오프), 15초마다 "여보세요?"를 보냅니다.
 * 메시지 해석은 하지 않고 그대로 넘깁니다. 해석은 main.ts가 합니다.
 */
export class RoomSocket {
  private ws: WebSocket | null = null;
  private retryMs = 1000;
  private pingTimer: number | undefined;
  private closedByUs = false;

  constructor(
    private roomId: string,
    private query: Record<string, string>,
    private onMessage: (msg: ServerMessage) => void,
    private onStatus: (s: "connecting" | "open" | "closed") => void,
  ) {}

  connect() {
    this.closedByUs = false;
    this.onStatus("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const q = new URLSearchParams({ room: this.roomId, ...this.query });
    const ws = new WebSocket(`${proto}://${location.host}/ws?${q}`);
    this.ws = ws;

    ws.onopen = () => {
      this.retryMs = 1000;
      this.onStatus("open");
      this.pingTimer = window.setInterval(() => this.send({ type: "ping" }), 15_000);
    };
    ws.onmessage = (ev) => {
      try {
        this.onMessage(JSON.parse(ev.data));
      } catch {
        /* 깨진 메시지는 무시 */
      }
    };
    ws.onclose = (ev) => {
      window.clearInterval(this.pingTimer);
      this.onStatus("closed");
      if (this.closedByUs || ev.code === 4001) return; // 4001 = 방이 꽉 참. 재시도 안 함
      window.setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(10_000, this.retryMs * 2);
    };
    ws.onerror = () => ws.close();
  }

  close() {
    this.closedByUs = true;
    this.ws?.close();
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
