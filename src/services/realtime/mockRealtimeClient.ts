import { onServerEvent, type ServerEvent } from "@/services/mock/events";
import { acknowledgeDelivery } from "@/services/mock/implementations/mockChatService";
import { mockDb } from "@/services/mock/db";
import { blockedEitherWay, presenceVisible } from "@/services/mock/privacy";
import { announcePresence } from "@/services/mock/presence";
import { projectNotification } from "@/services/mock/notificationProjection";
import { projectMessage } from "@/services/mock/projections";
import { publish } from "@/services/mock/events";

import type {
  RealtimeClient,
  RealtimeEvent,
  RealtimeEventMap,
  RealtimeStatus,
  Unsubscribe,
} from "./realtimeClient";

type Handler = (payload: never) => void;

const HEARTBEAT_MS = 5_000;

/**
 * In-browser realtime transport. Server facts arrive from the mock backend (same
 * tab or other tabs) and are projected for this tab's user, like a socket would.
 */
class MockRealtimeClient implements RealtimeClient {
  private handlers = new Map<RealtimeEvent, Set<Handler>>();
  private statusHandlers = new Set<(status: RealtimeStatus) => void>();
  private status: RealtimeStatus = "idle";
  private viewerId: string | null = null;
  private stopListening: Unsubscribe | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  connect({ userId }: { userId: string }) {
    if (this.viewerId === userId && this.status === "open") return;
    if (this.viewerId) this.disconnect();
    this.viewerId = userId;
    this.setStatus("connecting");
    this.stopListening = onServerEvent((event) => this.handle(event));
    announcePresence(userId, true);
    this.heartbeat = setInterval(() => announcePresence(userId, true), HEARTBEAT_MS);
    window.addEventListener("beforeunload", this.goOffline);
    this.setStatus("open");
  }

  disconnect() {
    if (this.viewerId) announcePresence(this.viewerId, false);
    this.stopListening?.();
    this.stopListening = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    window.removeEventListener("beforeunload", this.goOffline);
    this.viewerId = null;
    if (this.status !== "idle") this.setStatus("closed");
  }

  getStatus() {
    return this.status;
  }

  onStatusChange(handler: (status: RealtimeStatus) => void) {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  subscribe<K extends RealtimeEvent>(event: K, handler: (payload: RealtimeEventMap[K]) => void) {
    const set = this.handlers.get(event) ?? new Set<Handler>();
    set.add(handler as Handler);
    this.handlers.set(event, set);
    return () => {
      set.delete(handler as Handler);
    };
  }

  emitTyping(conversationId: string, isTyping: boolean) {
    if (!this.viewerId) return false;
    publish({ kind: "typing", conversationId, userId: this.viewerId, isTyping });
    return true;
  }

  private goOffline = () => {
    if (this.viewerId) announcePresence(this.viewerId, false);
  };

  private setStatus(status: RealtimeStatus) {
    this.status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private dispatch<K extends RealtimeEvent>(event: K, payload: RealtimeEventMap[K]) {
    this.handlers
      .get(event)
      ?.forEach((handler) => (handler as (p: RealtimeEventMap[K]) => void)(payload));
  }

  private isMember(conversationId: string): boolean {
    const conversation = mockDb.read().conversations[conversationId];
    return Boolean(this.viewerId && conversation?.memberIds.includes(this.viewerId));
  }

  /** Like ChatRealtime.onPresence: contacts (a shared conversation) whom the owner lets see it (PLAN.md §31.1). */
  private seesPresenceOf(userId: string): boolean {
    const db = mockDb.read();
    const viewerId = this.viewerId;
    if (!viewerId || !presenceVisible(db, viewerId, userId)) return false;
    return Object.values(db.conversations).some(
      (conversation) =>
        conversation.memberIds.includes(viewerId) && conversation.memberIds.includes(userId),
    );
  }

  private isDirect(conversationId: string): boolean {
    return mockDb.read().conversations[conversationId]?.kind === "direct";
  }

  /** Between a blocked pair, typing, receipts and reactions never pass (PLAN.md §31.1, ChatRealtime). */
  private blockedWith(userId: string): boolean {
    return Boolean(
      this.viewerId &&
      userId !== this.viewerId &&
      blockedEitherWay(mockDb.read(), this.viewerId, userId),
    );
  }

  private projected(messageId: string) {
    const db = mockDb.read();
    const record = db.messages[messageId];
    return record && this.viewerId ? projectMessage(db, record, this.viewerId) : null;
  }

  private handle(event: ServerEvent) {
    const viewerId = this.viewerId;
    if (!viewerId) return;
    switch (event.kind) {
      case "message.created":
      case "message.updated": {
        if (!this.isMember(event.conversationId)) return;
        const message = this.projected(event.messageId);
        if (!message) return;
        if (this.isDirect(event.conversationId) && this.blockedWith(message.senderId)) return;
        this.dispatch(event.kind, { message });
        if (event.kind === "message.created" && message.senderId !== viewerId) {
          acknowledgeDelivery(viewerId, event.conversationId, event.messageId);
        }
        return;
      }
      case "translation.updated": {
        if (!this.isMember(event.conversationId)) return;
        const message = this.projected(event.messageId);
        if (message?.translation) {
          this.dispatch("translation.updated", {
            conversationId: event.conversationId,
            messageId: event.messageId,
            translation: message.translation,
          });
        }
        return;
      }
      case "reaction":
        if (!this.isMember(event.conversationId) || this.blockedWith(event.userId)) return;
        this.dispatch(event.added ? "reaction.created" : "reaction.deleted", {
          conversationId: event.conversationId,
          messageId: event.messageId,
          userId: event.userId,
          emoji: event.emoji,
        });
        return;
      case "receipt":
        if (event.userId === viewerId || !this.isMember(event.conversationId)) return;
        if (this.blockedWith(event.userId)) return;
        if (event.receipt === "read") {
          this.dispatch("message.read", {
            conversationId: event.conversationId,
            readerId: event.userId,
            upToMessageId: event.upToMessageId,
          });
        } else {
          this.dispatch("message.delivered", {
            conversationId: event.conversationId,
            recipientId: event.userId,
            upToMessageId: event.upToMessageId,
          });
        }
        return;
      case "typing":
        if (event.userId === viewerId || !this.isMember(event.conversationId)) return;
        if (this.blockedWith(event.userId)) return;
        this.dispatch(event.isTyping ? "typing.started" : "typing.stopped", {
          conversationId: event.conversationId,
          userId: event.userId,
        });
        return;
      case "presence":
        if (event.userId === viewerId || !this.seesPresenceOf(event.userId)) return;
        if (event.online) this.dispatch("user.online", { userId: event.userId });
        else this.dispatch("user.offline", { userId: event.userId, lastSeenAt: event.at });
        return;
      case "notifications.read":
        if (event.recipientId === viewerId) this.dispatch("notifications.read", {});
        return;
      case "notification.created": {
        if (event.recipientId !== viewerId) return;
        const db = mockDb.read();
        const record = db.notifications[event.notificationId];
        const notification = record ? projectNotification(db, record) : null;
        if (notification) this.dispatch("notification.created", { notification });
        return;
      }
    }
  }
}

export const mockRealtimeClient = new MockRealtimeClient();
