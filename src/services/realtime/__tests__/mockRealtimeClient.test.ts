import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "@/services/mock/db";
import { mockChatService } from "@/services/mock/implementations/mockChatService";
import { setMockConfig } from "@/services/mock/latency";
import { isUserActive } from "@/services/mock/presence";
import { writeMockSession } from "@/services/mock/session";
import { mockRealtimeClient } from "@/services/realtime/mockRealtimeClient";

afterEach(() => mockRealtimeClient.disconnect());

const sendAs = async (userId: string, text: string, clientId: string) => {
  writeMockSession(userId);
  return mockChatService.sendMessage({
    conversationId: "conv_rafael_linh",
    clientId,
    text,
    media: [],
    replyToId: null,
  });
};

/** The realtime client projects server events for ITS user, regardless of who acted. */
describe("mockRealtimeClient", () => {
  it("pushes messages from the other side, translated for the viewer", async () => {
    mockRealtimeClient.connect({ userId: "usr_rafael" });
    const created = vi.fn();
    const translated = vi.fn();
    mockRealtimeClient.subscribe("message.created", created);
    mockRealtimeClient.subscribe("translation.updated", translated);

    await sendAs("usr_linh", "Em cũng yêu anh", "c1");

    expect(created).toHaveBeenCalledTimes(1);
    expect(created.mock.calls[0]?.[0].message.senderId).toBe("usr_linh");
    await waitFor(() =>
      expect(translated).toHaveBeenCalledWith(
        expect.objectContaining({
          translation: expect.objectContaining({ status: "translated", text: "Eu também te amo" }),
        }),
      ),
    );
  });

  it("acknowledges delivery when a message reaches the viewer", async () => {
    mockRealtimeClient.connect({ userId: "usr_rafael" });
    const message = await sendAs("usr_linh", "Oi", "d1");
    expect(
      mockDb.read().conversations["conv_rafael_linh"]?.lastDeliveredMessageId["usr_rafael"],
    ).toBe(message.id);
  });

  it("forwards read receipts of the other member", async () => {
    mockRealtimeClient.connect({ userId: "usr_rafael" });
    const read = vi.fn();
    mockRealtimeClient.subscribe("message.read", read);
    const message = await sendAs("usr_rafael", "Oi", "rr1");
    writeMockSession("usr_linh");
    await mockChatService.markAsRead("conv_rafael_linh", message.id);
    expect(read).toHaveBeenCalledWith({
      conversationId: "conv_rafael_linh",
      readerId: "usr_linh",
      upToMessageId: message.id,
    });
  });

  it("ignores events of conversations the viewer is not part of", async () => {
    mockRealtimeClient.connect({ userId: "usr_sofia" });
    const created = vi.fn();
    mockRealtimeClient.subscribe("message.created", created);
    await sendAs("usr_rafael", "Oi", "p1");
    expect(created).not.toHaveBeenCalled();
  });

  it("does not echo the viewer's own typing", () => {
    mockRealtimeClient.connect({ userId: "usr_rafael" });
    const typing = vi.fn();
    mockRealtimeClient.subscribe("typing.started", typing);
    mockRealtimeClient.emitTyping("conv_rafael_linh", true);
    expect(typing).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe", async () => {
    mockRealtimeClient.connect({ userId: "usr_rafael" });
    const created = vi.fn();
    const unsubscribe = mockRealtimeClient.subscribe("message.created", created);
    unsubscribe();
    await sendAs("usr_linh", "Oi", "u1");
    expect(created).not.toHaveBeenCalled();
  });

  it("announces presence and reports status", () => {
    const statuses: string[] = [];
    const stop = mockRealtimeClient.onStatusChange((status) => statuses.push(status));
    mockRealtimeClient.connect({ userId: "usr_rafael" });
    expect(mockRealtimeClient.getStatus()).toBe("open");
    expect(isUserActive("usr_rafael")).toBe(true);
    mockRealtimeClient.disconnect();
    expect(isUserActive("usr_rafael")).toBe(false);
    expect(statuses).toEqual(["connecting", "open", "closed"]);
    stop();
  });

  it("simulates replies from contacts that nobody is driving", async () => {
    setMockConfig({ autoReply: true, autoReplyDelayMs: 5 });
    mockRealtimeClient.connect({ userId: "usr_rafael" });
    const created = vi.fn();
    const read = vi.fn();
    mockRealtimeClient.subscribe("message.created", created);
    mockRealtimeClient.subscribe("message.read", read);
    await sendAs("usr_rafael", "Oi", "r1");
    await waitFor(() => expect(read).toHaveBeenCalled());
    await waitFor(() => expect(created).toHaveBeenCalledTimes(2));
    expect(created.mock.calls[1]?.[0].message.senderId).toBe("usr_linh");
  });

  it("never auto-replies for a user that is active in another tab", async () => {
    setMockConfig({ autoReply: true, autoReplyDelayMs: 5 });
    mockRealtimeClient.connect({ userId: "usr_linh" });
    const created = vi.fn();
    mockRealtimeClient.subscribe("message.created", created);
    await sendAs("usr_rafael", "Oi", "r2");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(created).toHaveBeenCalledTimes(1);
  });

  it("offline contacts get the message delivered but never read", async () => {
    setMockConfig({ autoReply: true, autoReplyDelayMs: 5 });
    mockRealtimeClient.connect({ userId: "usr_rafael" });
    const delivered = vi.fn();
    const read = vi.fn();
    mockRealtimeClient.subscribe("message.delivered", delivered);
    mockRealtimeClient.subscribe("message.read", read);
    writeMockSession("usr_rafael");
    await mockChatService.sendMessage({
      conversationId: "conv_rafael_yuki",
      clientId: "y1",
      text: "Oi",
      media: [],
      replyToId: null,
    });
    await waitFor(() => expect(delivered).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(read).not.toHaveBeenCalled();
  });
});
