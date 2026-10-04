import type { ISODateString } from "@/types/api";
import type { CountryCode, LanguageCode } from "@/types/language";
import type { MediaAttachment } from "@/types/media";
import type { ContentTranslation, DeliveryStatus, OriginalText } from "@/types/message";
import type { NotificationType } from "@/types/notification";
import type { UserPreferences } from "@/types/preferences";
import type { AuthProvider, UserRole } from "@/types/user";

/**
 * Server-side shape of the mock database. It is viewer-agnostic; mappers
 * project it to the domain types for the signed-in user (PLAN.md §16.2).
 */
export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  country: CountryCode;
  nativeLanguage: LanguageCode;
  learningLanguages: LanguageCode[];
  email: string | null;
  /** Mock only. The real backend stores an argon2id hash. */
  password: string | null;
  providers: AuthProvider[];
  role: UserRole;
  termsAcceptedVersion: string | null;
  onboardingCompletedAt: ISODateString | null;
  preferences: UserPreferences;
  /** Receiving-language changes, oldest first: each applies only to later messages (PLAN.md §21). */
  receivingLanguageHistory: { language: LanguageCode; since: ISODateString }[];
  isOnline: boolean;
  lastSeenAt: ISODateString | null;
  blockedUserIds: string[];
  createdAt: ISODateString;
}

export interface FollowRecord {
  followerId: string;
  followeeId: string;
  createdAt: ISODateString;
}

export interface ConversationRecord {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  avatarUrl: string | null;
  createdBy: string;
  memberIds: string[];
  /** Per-member cursors: delivery/read ticks are derived from them. */
  lastReadMessageId: Record<string, string | null>;
  lastDeliveredMessageId: Record<string, string | null>;
  mutedUntil: Record<string, ISODateString | null>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type MessageContentRecord =
  | { type: "text"; body: OriginalText }
  | { type: "image"; media: MediaAttachment[]; caption: OriginalText | null }
  | { type: "video"; media: MediaAttachment; caption: OriginalText | null }
  | { type: "file"; media: MediaAttachment; fileName: string }
  | { type: "story_reply"; storyId: string; body: OriginalText };

export interface MessageRecord {
  receipts?: Record<string, boolean>;
  id: string;
  clientId: string | null;
  conversationId: string;
  senderId: string;
  content: MessageContentRecord;
  /** One translation per target language (fan-out). */
  translations: Record<LanguageCode, ContentTranslation>;
  /** Literal translations for Learning Mode, per target language. */
  literals: Record<LanguageCode, string>;
  replyToId: string | null;
  reactions: { userId: string; emoji: string }[];
  /** Forced status for failed sends in the mock (otherwise derived). */
  statusOverride: DeliveryStatus | null;
  createdAt: ISODateString;
}

export interface PostRecord {
  id: string;
  authorId: string;
  media: MediaAttachment[];
  caption: OriginalText | null;
  captionTranslations: Record<LanguageCode, ContentTranslation>;
  likedBy: string[];
  createdAt: ISODateString;
}

export interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  body: OriginalText;
  translations: Record<LanguageCode, ContentTranslation>;
  createdAt: ISODateString;
}

export interface StoryRecord {
  id: string;
  authorId: string;
  media: MediaAttachment;
  overlayText: OriginalText | null;
  overlayTranslations: Record<LanguageCode, ContentTranslation>;
  viewedBy: string[];
  reactions: { userId: string; emoji: string }[];
  createdAt: ISODateString;
  expiresAt: ISODateString;
}

export interface NotificationRecord {
  id: string;
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId: string | null;
  commentId: string | null;
  storyId: string | null;
  emoji: string | null;
  conversationId: string | null;
  messageId: string | null;
  readAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface MockDatabase {
  users: Record<string, UserRecord>;
  follows: FollowRecord[];
  conversations: Record<string, ConversationRecord>;
  messages: Record<string, MessageRecord>;
  posts: Record<string, PostRecord>;
  comments: Record<string, CommentRecord>;
  stories: Record<string, StoryRecord>;
  notifications: Record<string, NotificationRecord>;
}
