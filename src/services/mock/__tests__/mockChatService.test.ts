import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { mockDb } from "@/services/mock/db";
import { mockChatService } from "@/services/mock/implementations/mockChatService";
import { setMockConfig } from "@/services/mock/latency";
import { writeMockSession } from "@/services/mock/session";

const asRafael = () => writeMockSession("usr_rafael");
const asLinh = () => writeMockSession("usr_linh");

const send = (
  text: string,
  clientId: string = crypto.randomUUID(),
  conversationId = "conv_rafael_linh",
) => mockChatService.sendMessage({ conversationId, clientId, text, media: [], replyToId: null });

describe("mockChatService", () => {
  beforeEach(asRafael);

  describe("conversations", () => {
    it("lists only the viewer's conversations, newest first, with unread counts", async () => {
      const list = await mockChatService.getConversations();
      expect(list.map((c) => c.id)).not.toContain("conv_linh_jisoo");
      const dates = list.map((c) => c.updatedAt);
      expect([...dates].sort().reverse()).toEqual(dates);
      expect(list.find((c) => c.id === "conv_rafael_minh")?.unreadCount).toBe(2);
      expect(list.find((c) => c.id === "conv_rafael_sofia")?.unreadCount).toBe(1);
      expect(list.find((c) => c.id === "conv_rafael_linh")?.unreadCount).toBe(0);
    });

    it("projects the last message translated into the viewer's language", async () => {
      const list = await mockChatService.getConversations();
      const minh = list.find((c) => c.id === "conv_rafael_minh");
      expect(minh?.lastMessage?.translation).toMatchObject({
        targetLanguage: "pt-BR",
        status: "translated",
      });
      expect(minh?.lastMessage?.translation?.text).toBe("Você quer comer phở com a gente?");
    });

    it("forbids conversations of other people", async () => {
      await expect(mockChatService.getConversation("conv_linh_jisoo")).rejects.toMatchObject({
        code: "forbidden",
      });
      await expect(mockChatService.getConversation("nope")).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });

  describe("messages", () => {
    it("paginates backwards in pages of 30 with chronological items", async () => {
      const first = await mockChatService.getMessages("conv_rafael_linh", null);
      expect(first.items).toHaveLength(30);
      expect(first.nextCursor).not.toBeNull();
      const created = first.items.map((m) => m.createdAt);
      expect([...created].sort()).toEqual(created);
      const second = await mockChatService.getMessages("conv_rafael_linh", first.nextCursor);
      expect(second.items.length).toBeGreaterThan(0);
      expect(second.nextCursor).toBeNull();
      const lastOfSecond = second.items.at(-1);
      const firstOfFirst = first.items[0];
      expect(lastOfSecond && firstOfFirst && lastOfSecond.createdAt <= firstOfFirst.createdAt).toBe(
        true,
      );
      const ids = new Set([...first.items, ...second.items].map((m) => m.id));
      expect(ids.size).toBe(first.items.length + second.items.length);
    });

    it("shows each side its own language (same message, two projections)", async () => {
      const rafaelView = (await mockChatService.getMessages("conv_rafael_linh", null)).items.at(-2);
      asLinh();
      const linhView = (await mockChatService.getMessages("conv_rafael_linh", null)).items.at(-2);
      expect(rafaelView?.id).toBe(linhView?.id);
      expect(rafaelView?.translation?.text).toBe("Pode ser! Sábado às 8 da noite, então.");
      // Linh is the sender here: her translation shows what Rafael received.
      expect(linhView?.translation?.targetLanguage).toBe("pt-BR");
      expect(linhView?.content).toEqual(rafaelView?.content);
    });

    it("derives ticks from the other member's cursors", async () => {
      const items = (await mockChatService.getMessages("conv_rafael_yuki", null)).items;
      expect(items.at(-1)?.deliveryStatus).toBe("delivered");
    });
  });

  describe("sending", () => {
    it("creates the message in the sender's native language", async () => {
      const message = await send("Eu te amo");
      expect(message.content).toEqual({
        type: "text",
        body: { text: "Eu te amo", language: "pt-BR" },
      });
      expect(message.deliveryStatus).toBe("sent");
      expect(message.senderId).toBe("usr_rafael");
    });

    it("is idempotent by clientId (safe retries)", async () => {
      const first = await send("Oi", "client-1");
      const again = await send("Oi", "client-1");
      expect(again.id).toBe(first.id);
      const count = Object.values(mockDb.read().messages).filter(
        (m) => m.clientId === "client-1",
      ).length;
      expect(count).toBe(1);
    });

    it("rejects empty messages and foreign replies", async () => {
      await expect(send("   ")).rejects.toMatchObject({ code: "validation" });
      await expect(
        mockChatService.sendMessage({
          conversationId: "conv_rafael_linh",
          clientId: "x",
          text: "hi",
          media: [],
          replyToId: "msg_rafael_sofia_000",
        }),
      ).rejects.toMatchObject({ code: "validation" });
    });

    it("translates for the recipient through the pipeline (pending → translated)", async () => {
      const message = await send("Eu te amo");
      await waitFor(() =>
        expect(mockDb.read().messages[message.id]?.translations["vi-VN"]).toMatchObject({
          status: "translated",
          text: "Anh yêu em",
          version: 1,
        }),
      );
    });

    it("marks failed translations when the provider fails", async () => {
      setMockConfig({ translationFailureRate: 1 });
      const message = await send("Bom dia");
      await waitFor(() =>
        expect(mockDb.read().messages[message.id]?.translations["vi-VN"]?.status).toBe("failed"),
      );
    });

    it("publishes an improved v2 translation later", async () => {
      setMockConfig({ improvedTranslationRate: 1 });
      const message = await send("Estou com saudade de você.");
      await waitFor(() =>
        expect(mockDb.read().messages[message.id]?.translations["vi-VN"]?.version).toBe(2),
      );
      const translation = mockDb.read().messages[message.id]?.translations["vi-VN"];
      expect(translation?.text).toBe("Anh nhớ em.");
      expect(mockDb.read().messages[message.id]?.literals["vi-VN"]).toBe(
        "Estou com saudade (lembrança) de você.",
      );
    });

    it("does not translate between the same language", async () => {
      asLinh();
      const conversation = await mockChatService.getOrCreateDirectConversation("usr_minh");
      const message = await send("Đi chứ!", crypto.randomUUID(), conversation.id);
      expect(message.translation).toMatchObject({ status: "not_needed", text: null });
    });

    it("sends images with a caption", async () => {
      const message = await mockChatService.sendMessage({
        conversationId: "conv_rafael_linh",
        clientId: "img",
        text: "Olha isso",
        media: [
          {
            kind: "image",
            url: "data:image/png;base64,AAA",
            mimeType: "image/png",
            sizeBytes: 3,
            width: 1,
            height: 1,
            durationMs: null,
            fileName: "a.png",
          },
        ],
        replyToId: null,
      });
      expect(message.content.type).toBe("image");
      if (message.content.type === "image") expect(message.content.caption?.text).toBe("Olha isso");
    });
  });

  describe("receipts and reactions", () => {
    it("marks as read and moves the cursor forward only", async () => {
      const page = await mockChatService.getMessages("conv_rafael_minh", null);
      const last = page.items.at(-1);
      if (!last) throw new Error("no messages");
      await mockChatService.markAsRead("conv_rafael_minh", last.id);
      const list = await mockChatService.getConversations();
      expect(list.find((c) => c.id === "conv_rafael_minh")?.unreadCount).toBe(0);
      const firstId = page.items[0]?.id ?? "";
      await mockChatService.markAsRead("conv_rafael_minh", firstId);
      expect(mockDb.read().conversations["conv_rafael_minh"]?.lastReadMessageId["usr_rafael"]).toBe(
        last.id,
      );
    });

    it("turns sent into read once the other side reads", async () => {
      const message = await send("Tudo bem?");
      asLinh();
      await mockChatService.markAsRead("conv_rafael_linh", message.id);
      asRafael();
      const page = await mockChatService.getMessages("conv_rafael_linh", null);
      expect(page.items.find((m) => m.id === message.id)?.deliveryStatus).toBe("read");
    });

    it("toggles reactions", async () => {
      const message = await send("Oi");
      const added = await mockChatService.react(message.id, "👍");
      expect(added.reactions).toEqual([{ emoji: "👍", count: 1, reactedByMe: true }]);
      const removed = await mockChatService.react(message.id, "👍");
      expect(removed.reactions).toEqual([]);
    });

    it("forwards the original content to other conversations", async () => {
      const message = await send("Encaminha");
      await mockChatService.forward(message.id, ["conv_rafael_sofia", "conv_rafael_emma"]);
      const forwarded = Object.values(mockDb.read().messages).filter(
        (m) => m.content.type === "text" && m.content.body.text === "Encaminha",
      );
      expect(forwarded.map((m) => m.conversationId).sort()).toEqual([
        "conv_rafael_emma",
        "conv_rafael_linh",
        "conv_rafael_sofia",
      ]);
    });

    it("mutes a conversation for the viewer only", async () => {
      const muted = await mockChatService.setMuted("conv_rafael_linh", true);
      expect(muted.mutedUntil).not.toBeNull();
      asLinh();
      expect((await mockChatService.getConversation("conv_rafael_linh")).mutedUntil).toBeNull();
    });
  });

  describe("starting conversations", () => {
    it("reuses an existing direct conversation", async () => {
      const conversation = await mockChatService.getOrCreateDirectConversation("usr_linh");
      expect(conversation.id).toBe("conv_rafael_linh");
    });

    it("creates a new direct conversation", async () => {
      const conversation = await mockChatService.getOrCreateDirectConversation("usr_mei");
      expect(conversation.kind).toBe("direct");
      expect(conversation.members.map((m) => m.user.id).sort()).toEqual(["usr_mei", "usr_rafael"]);
    });

    it("respects 'who can message me' and blocks", async () => {
      mockDb.update((db) => {
        const mei = db.users["usr_mei"];
        const leo = db.users["usr_leo"];
        if (mei) mei.preferences.privacy.whoCanMessage = "nobody";
        if (leo) leo.preferences.privacy.whoCanMessage = "followers";
        db.users["usr_arjun"]?.blockedUserIds.push("usr_rafael");
      });
      await expect(mockChatService.getOrCreateDirectConversation("usr_mei")).rejects.toMatchObject({
        code: "forbidden",
      });
      await expect(mockChatService.getOrCreateDirectConversation("usr_leo")).rejects.toMatchObject({
        code: "forbidden",
      });
      await expect(
        mockChatService.getOrCreateDirectConversation("usr_arjun"),
      ).rejects.toMatchObject({ code: "forbidden" });
      mockDb.update((db) => {
        db.follows.push({
          followerId: "usr_leo",
          followeeId: "usr_rafael",
          createdAt: new Date().toISOString(),
        });
      });
      await expect(mockChatService.getOrCreateDirectConversation("usr_leo")).resolves.toMatchObject(
        { kind: "direct" },
      );
    });

    it("enforces changed privacy and blocks on an existing conversation and forwards", async () => {
      const original = await send("Before restriction", "before");
      mockDb.update((db) => {
        const linh = db.users["usr_linh"];
        if (linh) linh.preferences.privacy.whoCanMessage = "nobody";
      });
      await expect(send("After restriction", "after")).rejects.toMatchObject({ code: "forbidden" });
      await expect(
        mockChatService.forward(original.id, ["conv_rafael_linh"]),
      ).rejects.toMatchObject({ code: "forbidden" });
      mockDb.update((db) => {
        const linh = db.users["usr_linh"];
        if (linh) linh.preferences.privacy.whoCanMessage = "everyone";
        db.users["usr_rafael"]?.blockedUserIds.push("usr_linh");
      });
      await expect(send("Blocked outward", "blocked-out")).rejects.toMatchObject({
        code: "forbidden",
      });
      asLinh();
      await expect(send("Blocked inward", "blocked-in")).rejects.toMatchObject({
        code: "forbidden",
      });
      expect(
        Object.values(mockDb.read().messages).filter((m) => m.clientId?.startsWith("blocked-")),
      ).toHaveLength(0);
    });

    it("refuses to message yourself", async () => {
      await expect(
        mockChatService.getOrCreateDirectConversation("usr_rafael"),
      ).rejects.toMatchObject({ code: "validation" });
    });
  });

  describe("groups", () => {
    it("lets each person create only one group", async () => {
      const group = await mockChatService.createGroup({
        title: " Viagem ",
        memberIds: ["usr_linh", "usr_sofia"],
      });
      expect(group).toMatchObject({ kind: "group", title: "Viagem", createdBy: "usr_rafael" });
      await expect(
        mockChatService.createGroup({ title: "Outro", memberIds: ["usr_linh", "usr_emma"] }),
      ).rejects.toMatchObject({ code: "conflict" });
      asLinh();
      await expect(
        mockChatService.createGroup({ title: "Linh's", memberIds: ["usr_rafael", "usr_minh"] }),
      ).resolves.toMatchObject({ createdBy: "usr_linh" });
    });

    it("requires a name and at least two other people", async () => {
      await expect(
        mockChatService.createGroup({ title: " ", memberIds: ["usr_linh", "usr_emma"] }),
      ).rejects.toMatchObject({
        code: "validation",
      });
      await expect(
        mockChatService.createGroup({ title: "Duo", memberIds: ["usr_linh"] }),
      ).rejects.toMatchObject({
        code: "validation",
      });
    });

    it("translates group messages into every member language", async () => {
      const group = await mockChatService.createGroup({
        title: "Trio",
        memberIds: ["usr_linh", "usr_sofia"],
      });
      const message = await send("Obrigado!", crypto.randomUUID(), group.id);
      await waitFor(() => {
        const translations = mockDb.read().messages[message.id]?.translations ?? {};
        expect(translations["vi-VN"]?.text).toBe("Cảm ơn!");
        expect(translations["es-ES"]?.text).toBe("¡Gracias!");
      });
    });
  });
});
