import type {
  RealtimeClient,
  RealtimeEvent,
  RealtimeEventMap,
  RealtimeStatus,
  Unsubscribe,
} from "./realtimeClient";
import { backoffDelay, parseFrame, socketUrl } from "./wsProtocol";

type Handler = (payload: unknown) => void;
type SocketFactory = (url: string) => WebSocket;

const HEARTBEAT_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;

/**
 * Real-time over the backend WebSocket, authenticated by the session cookie (PLAN.md §26).
 * Reconnects with backoff; the bridge refetches what was missed when the status returns to "open".
 */
export class WsRealtimeClient implements RealtimeClient {
  private socket: WebSocket | null = null;
  private status: RealtimeStatus = "idle";
  private wanted = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly handlers = new Map<RealtimeEvent, Set<Handler>>();
  private readonly statusHandlers = new Set<(status: RealtimeStatus) => void>();

  constructor(
    private readonly url: () => string = () => socketUrl(window.location),
    private readonly createSocket: SocketFactory = (url) => new WebSocket(url),
  ) {}

  connect() {
    if (this.wanted) return;
    this.wanted = true;
    this.attempt = 0;
    window.addEventListener("online", this.retryNow);
    window.addEventListener("offline", this.abandon);
    document.addEventListener("visibilitychange", this.retryWhenVisible);
    this.open();
  }

  disconnect() {
    this.wanted = false;
    window.removeEventListener("online", this.retryNow);
    window.removeEventListener("offline", this.abandon);
    document.removeEventListener("visibilitychange", this.retryWhenVisible);
    this.clearTimers();
    this.detach(1000);
    this.setStatus("closed");
  }

  getStatus() {
    return this.status;
  }

  onStatusChange(handler: (status: RealtimeStatus) => void): Unsubscribe {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  subscribe<K extends RealtimeEvent>(
    event: K,
    handler: (payload: RealtimeEventMap[K]) => void,
  ): Unsubscribe {
    const set = this.handlers.get(event) ?? new Set<Handler>();
    set.add(handler as Handler);
    this.handlers.set(event, set);
    return () => {
      set.delete(handler as Handler);
    };
  }

  emitTyping(conversationId: string, isTyping: boolean) {
    this.send({ type: "typing", conversationId, isTyping });
  }

  private open() {
    this.setStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    const socket = this.createSocket(this.url());
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.attempt = 0;
      this.setStatus("open");
      this.startHeartbeat();
    };
    socket.onmessage = (event: MessageEvent) => {
      if (this.socket !== socket) return;
      const frame = parseFrame(event.data);
      if (frame.kind === "pong") this.clearPongTimer();
      if (frame.kind === "event") this.handlers.get(frame.type)?.forEach((h) => h(frame.payload));
    };
    socket.onclose = () => {
      if (this.socket === socket) this.abandon();
    };
  }

  /**
   * Gives up on the current socket at once. On a dead network, close() only fires "close" after the
   * closing handshake times out, so waiting for it would leave the app silently offline.
   */
  private abandon = () => {
    this.stopHeartbeat();
    this.detach(4000);
    if (this.wanted && !this.reconnectTimer) this.scheduleReconnect();
  };

  private detach(code: number) {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      socket.close(code);
    }
  }

  private scheduleReconnect() {
    this.setStatus("reconnecting");
    const delay = backoffDelay(this.attempt);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  /** Back online or back to the tab: don't wait for the backoff. */
  private retryNow = () => {
    if (!this.wanted || !this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.attempt = 0;
    this.open();
  };

  private retryWhenVisible = () => {
    if (document.visibilityState === "visible") this.retryNow();
  };

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "ping" });
      this.clearPongTimer();
      // No answer: the connection is dead even if the browser hasn't noticed yet.
      this.pongTimer = setTimeout(this.abandon, PONG_TIMEOUT_MS);
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.clearPongTimer();
  }

  private clearPongTimer() {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  private clearTimers() {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private send(message: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private setStatus(status: RealtimeStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }
}

export const wsRealtimeClient = new WsRealtimeClient();
