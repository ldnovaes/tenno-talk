import type { Conversation, SendRestriction } from "@/types/conversation";

interface QueuedSend {
  blocked: boolean;
  failureCode?: string;
  input: { conversationId: string };
}

/**
 * Entries that take part in the per-conversation order, oldest first. A permanently failed entry keeps its
 * retry/discard actions in the chat but no longer holds the messages written after it; a retryable failure
 * still does, so a conversation never arrives out of order (PLAN.md §13.1).
 */
export function dispatchable<T extends QueuedSend>(pending: readonly T[]): T[] {
  return pending.filter((entry) => !entry.blocked);
}

/** Refused sends of a conversation, to try again once its restriction is lifted (PLAN.md §31.1). */
export function refusedIn<T extends QueuedSend>(
  pending: readonly T[],
  conversationId: string,
): T[] {
  return pending.filter(
    (entry) =>
      entry.blocked &&
      entry.failureCode === "forbidden" &&
      entry.input.conversationId === conversationId,
  );
}

/**
 * Conversations whose send restriction was just lifted (unblock, a follow back, a settings change), given the
 * restrictions seen before. Conversations seen for the first time are not reported: nothing changed for them.
 */
export function liftedRestrictions(
  before: ReadonlyMap<string, SendRestriction | null>,
  conversations: readonly Pick<Conversation, "id" | "sendRestriction">[],
): string[] {
  return conversations
    .filter((conversation) => !conversation.sendRestriction && before.get(conversation.id))
    .map((conversation) => conversation.id);
}
