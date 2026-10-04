import { useSessionStore } from "@/stores/sessionStore";
import { AppError } from "@/lib/errors";
import { http } from "@/services/http/httpClient";
import { uploadMedia } from "@/services/http/media";
import { toAppError } from "@/lib/errors";
import type { Message } from "@/types/message";
import { updatePending, type PendingSend } from "./store";

/** Atomic claim prevents competing tabs; clientId also deduplicates a lost HTTP response. */
export async function dispatchPending(entry: PendingSend): Promise<Message | null> {
  if (!navigator.onLine || useSessionStore.getState().userId !== entry.userId) return null;
  let claimed = false;
  const current = await updatePending(entry.key, (value) => {
    if (!value || value.blocked || value.nextAttempt > Date.now() || value.leaseUntil > Date.now())
      return value;
    claimed = true;
    return { ...value, leaseUntil: Date.now() + 60_000 };
  });
  if (!claimed || !current) return null;
  const urls: string[] = [];
  const renew = setInterval(() => {
    void updatePending(entry.key, (e) =>
      e ? { ...e, leaseUntil: Date.now() + 60_000 } : undefined,
    );
  }, 20_000);
  try {
    const viewer = await http<{ id: string }>("GET", "/api/me");
    if (viewer.id !== entry.userId)
      throw new AppError(
        "unauthenticated",
        "Sign in to the original account to send this message.",
      );
    const input = current.input;
    const media = input.media.map((item, index) => {
      const blob = current.blobs[index];
      if (!blob) return item;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      return { ...item, url };
    });
    let mediaIds = current.mediaIds ?? [];
    for (let index = mediaIds.length; index < media.length; index++) {
      const item = media[index];
      if (!item) continue;
      mediaIds = [
        ...mediaIds,
        ...(await uploadMedia([item], undefined, entry.userId)).map((m) => m.id),
      ];
      await updatePending(entry.key, (e) => (e ? { ...e, mediaIds } : undefined));
    }
    const stillQueued = await updatePending(entry.key, (value) => value);
    if (!stillQueued) return null;
    if (useSessionStore.getState().userId !== entry.userId) {
      await updatePending(entry.key, (value) => (value ? { ...value, leaseUntil: 0 } : value));
      return null;
    }
    const result = current.storyId
      ? (
          await http<{ message: Message }>(
            "POST",
            `/api/stories/${encodeURIComponent(current.storyId)}/replies`,
            { accountId: entry.userId, body: { clientId: input.clientId, text: input.text } },
          )
        ).message
      : await http<Message>(
          "POST",
          `/api/conversations/${encodeURIComponent(input.conversationId)}/messages`,
          {
            accountId: entry.userId,
            body: {
              clientId: input.clientId,
              text: input.text,
              mediaIds,
              replyToId: input.replyToId,
            },
          },
        );
    await updatePending(entry.key, () => undefined);
    return result;
  } catch (error) {
    const failure = toAppError(error);
    await updatePending(entry.key, (e) =>
      e
        ? {
            ...e,
            leaseUntil: 0,
            attempts: e.attempts + 1,
            blocked: !failure.retryable,
            failureCode: failure.code,
            nextAttempt:
              Date.now() +
              Math.min(60_000, 1000 * 2 ** Math.min(e.attempts, 6)) * (1 + Math.random()),
            message: { ...e.message, deliveryStatus: failure.retryable ? "sending" : "failed" },
          }
        : undefined,
    );
    throw error;
  } finally {
    clearInterval(renew);
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}
