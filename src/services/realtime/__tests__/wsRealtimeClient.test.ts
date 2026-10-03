import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RealtimeStatus } from "../realtimeClient";
import { WsRealtimeClient } from "../wsRealtimeClient";
import { backoffDelay, parseFrame, socketUrl } from "../wsProtocol";

/** Just enough of a WebSocket to drive the client by hand. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: unknown[] = [];
  closedWith: number | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close(code: number) {
    this.closedWith = code;
    this.readyState = 3;
    this.onclose?.();
  }

  /** A dead network: close() starts a handshake that never finishes, so "close" never fires. */
  hang() {
    this.close = (code: number) => {
      this.closedWith = code;
      this.readyState = 2;
    };
  }

  serverOpens() {
    this.readyState = 1;
    this.onopen?.();
  }

  serverSends(frame: unknown) {
    this.onmessage?.({ data: typeof frame === "string" ? frame : JSON.stringify(frame) });
  }

  dropped() {
    this.readyState = 3;
    this.onclose?.();
  }
}

function latest(): FakeSocket {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error("no socket");
  return socket;
}

function makeClient() {
  const client = new WsRealtimeClient(
    () => "ws://test/ws",
    (url) => new FakeSocket(url) as unknown as WebSocket,
  );
  const statuses: RealtimeStatus[] = [];
  client.onStatusChange((status) => statuses.push(status));
  return { client, statuses };
}

describe("wsProtocol", () => {
  it("parses known events and pongs", () => {
    expect(parseFrame('{"type":"user.online","payload":{"userId":"u1"}}')).toEqual({
      kind: "event",
      type: "user.online",
      payload: { userId: "u1" },
    });
    expect(parseFrame('{"type":"pong","payload":{}}')).toEqual({ kind: "pong" });
  });

  it.each([
    ["not json"],
    ['{"type":"hack.everything","payload":{}}'],
    ['{"payload":{}}'],
    ['{"type":"user.online"}'],
    ["null"],
    ["42"],
  ])("ignores %s", (frame) => {
    expect(parseFrame(frame)).toEqual({ kind: "ignored" });
  });

  it("ignores binary frames", () => {
    expect(parseFrame(new ArrayBuffer(2))).toEqual({ kind: "ignored" });
  });

  it("backs off exponentially with jitter up to 30 seconds", () => {
    expect(backoffDelay(0, () => 0)).toBe(500);
    expect(backoffDelay(0, () => 1)).toBe(1_000);
    expect(backoffDelay(3, () => 1)).toBe(8_000);
    expect(backoffDelay(10, () => 1)).toBe(30_000);
    expect(backoffDelay(10, () => 0)).toBe(15_000);
  });

  it("uses the page's origin and wss on https", () => {
    expect(socketUrl({ protocol: "https:", host: "tenno.app" })).toBe("wss://tenno.app/ws");
    expect(socketUrl({ protocol: "http:", host: "localhost:5173" })).toBe("ws://localhost:5173/ws");
  });
});

describe("WsRealtimeClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(1);
    FakeSocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("connects and reports open", () => {
    const { client, statuses } = makeClient();
    client.connect();
    expect(latest().url).toBe("ws://test/ws");
    latest().serverOpens();
    expect(statuses).toEqual(["connecting", "open"]);
    expect(client.getStatus()).toBe("open");
    client.disconnect();
  });

  it("connecting twice keeps one socket", () => {
    const { client } = makeClient();
    client.connect();
    client.connect();
    expect(FakeSocket.instances).toHaveLength(1);
    client.disconnect();
  });

  it("delivers server events to subscribers only", () => {
    const { client } = makeClient();
    const online = vi.fn();
    const typing = vi.fn();
    client.subscribe("user.online", online);
    const stop = client.subscribe("typing.started", typing);
    stop();
    client.connect();
    latest().serverOpens();
    latest().serverSends({ type: "user.online", payload: { userId: "u1" } });
    latest().serverSends({ type: "typing.started", payload: { conversationId: "c", userId: "u" } });
    latest().serverSends("garbage");
    expect(online).toHaveBeenCalledWith({ userId: "u1" });
    expect(typing).not.toHaveBeenCalled();
    client.disconnect();
  });

  it("sends typing only while open", () => {
    const { client } = makeClient();
    client.connect();
    client.emitTyping("c1", true);
    expect(latest().sent).toEqual([]);
    latest().serverOpens();
    client.emitTyping("c1", true);
    expect(latest().sent).toEqual([{ type: "typing", conversationId: "c1", isTyping: true }]);
    client.disconnect();
  });

  it("reconnects with growing delays and resets after success", () => {
    const { client, statuses } = makeClient();
    client.connect();
    latest().dropped();
    expect(client.getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);

    latest().dropped();
    vi.advanceTimersByTime(1_999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);

    latest().serverOpens();
    expect(statuses.at(-1)).toBe("open");
    latest().dropped();
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(4);
    client.disconnect();
  });

  it("treats going offline as a lost connection and retries as soon as it's back", () => {
    const { client } = makeClient();
    client.connect();
    const socket = latest();
    socket.serverOpens();
    socket.hang();

    window.dispatchEvent(new Event("offline"));
    expect(client.getStatus()).toBe("reconnecting");
    expect(socket.closedWith).toBe(4000);

    window.dispatchEvent(new Event("online"));
    expect(FakeSocket.instances).toHaveLength(2);
    latest().serverOpens();
    expect(client.getStatus()).toBe("open");
    client.disconnect();
  });

  it("reconnects even when a dead socket never confirms the close", () => {
    const { client } = makeClient();
    client.connect();
    const socket = latest();
    socket.serverOpens();
    socket.hang();
    vi.advanceTimersByTime(35_000);
    expect(socket.closedWith).toBe(4000);
    expect(client.getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
    client.disconnect();
  });

  it("pings every 25 seconds and drops a connection that stops answering", () => {
    const { client } = makeClient();
    client.connect();
    const socket = latest();
    socket.serverOpens();

    vi.advanceTimersByTime(25_000);
    expect(socket.sent).toEqual([{ type: "ping" }]);
    socket.serverSends({ type: "pong", payload: {} });
    vi.advanceTimersByTime(10_000);
    expect(socket.closedWith).toBeNull();

    vi.advanceTimersByTime(15_000);
    vi.advanceTimersByTime(10_000);
    expect(socket.closedWith).toBe(4000);
    expect(client.getStatus()).toBe("reconnecting");
    client.disconnect();
  });

  it("disconnect closes cleanly and stops reconnecting", () => {
    const { client, statuses } = makeClient();
    client.connect();
    const socket = latest();
    socket.serverOpens();
    client.disconnect();
    expect(socket.closedWith).toBe(1000);
    expect(statuses.at(-1)).toBe("closed");
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("ignores events from a socket it already replaced", () => {
    const { client } = makeClient();
    const online = vi.fn();
    client.subscribe("user.online", online);
    client.connect();
    const old = latest();
    old.dropped();
    vi.advanceTimersByTime(1_000);
    old.serverSends({ type: "user.online", payload: { userId: "ghost" } });
    expect(online).not.toHaveBeenCalled();
    client.disconnect();
  });
});
