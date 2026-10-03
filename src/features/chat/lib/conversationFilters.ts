import type { Conversation } from "@/types/conversation";
import type { User } from "@/types/user";

export type ConversationFilter = "all" | "unread" | "groups";

/** The other person in a direct conversation (or null for groups). */
export function otherMember(conversation: Conversation, viewerId: string) {
  if (conversation.kind !== "direct") return null;
  return conversation.members.find((member) => member.user.id !== viewerId) ?? null;
}

export function conversationTitle(conversation: Conversation, viewerId: string): string {
  if (conversation.kind === "group") return conversation.title ?? "";
  return otherMember(conversation, viewerId)?.user.displayName ?? "";
}

/** Avatar subject: the other person, or a pseudo-user for groups. */
export function conversationAvatar(conversation: Conversation, viewerId: string): User {
  const other = otherMember(conversation, viewerId);
  if (other) return other.user;
  return {
    id: conversation.id,
    username: "",
    displayName: conversation.title ?? "",
    avatarUrl: conversation.avatarUrl,
  };
}

export function isMuted(conversation: Conversation, now = new Date()): boolean {
  return conversation.mutedUntil !== null && new Date(conversation.mutedUntil) > now;
}

export function filterConversations(
  list: readonly Conversation[],
  options: { filter: ConversationFilter; query: string; viewerId: string },
): Conversation[] {
  const query = options.query.trim().toLowerCase().replace(/^@/, "");
  return list.filter((conversation) => {
    if (options.filter === "unread" && conversation.unreadCount === 0) return false;
    if (options.filter === "groups" && conversation.kind !== "group") return false;
    if (!query) return true;
    const title = conversationTitle(conversation, options.viewerId).toLowerCase();
    const username = otherMember(conversation, options.viewerId)?.user.username ?? "";
    const preview = previewSource(conversation).toLowerCase();
    return title.includes(query) || username.includes(query) || preview.includes(query);
  });
}

function previewSource(conversation: Conversation): string {
  const last = conversation.lastMessage;
  if (!last) return "";
  const original =
    last.content.type === "text" || last.content.type === "story_reply"
      ? last.content.body.text
      : last.content.type === "image" || last.content.type === "video"
        ? (last.content.caption?.text ?? "")
        : "";
  return `${original} ${last.translation?.text ?? ""}`;
}

/** Total unread for the nav badge; muted conversations do not count. */
export function totalUnread(list: readonly Conversation[]): number {
  return list.reduce(
    (sum, conversation) => sum + (isMuted(conversation) ? 0 : conversation.unreadCount),
    0,
  );
}
