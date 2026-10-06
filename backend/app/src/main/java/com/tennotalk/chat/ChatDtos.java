package com.tennotalk.chat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.tennotalk.users.UserDtos.UserDto;

/** Wire types mirroring src/types/message.ts and conversation.ts. */
public final class ChatDtos {

    private ChatDtos() {}

    public record OriginalTextDto(String text, String language) {}

    public record ContentTranslationDto(String targetLanguage, String text, String status, int version, Instant updatedAt) {}

    public record MediaAttachmentDto(
            UUID id,
            String kind,
            String url,
            String thumbnailUrl,
            Integer width,
            Integer height,
            Integer durationMs,
            String mimeType,
            long sizeBytes,
            String alt) {}

    /** Serialized with the runtime type: each variant carries its {@code type}. */
    public sealed interface MessageContentDto
            permits TextContent, ImageContent, VideoContent, FileContent, StoryReplyContent, StoryReactionContent {
        String type();
    }

    public record TextContent(String type, OriginalTextDto body) implements MessageContentDto {
        public TextContent(OriginalTextDto body) {
            this("text", body);
        }
    }

    public record ImageContent(String type, List<MediaAttachmentDto> media, OriginalTextDto caption) implements MessageContentDto {
        public ImageContent(List<MediaAttachmentDto> media, OriginalTextDto caption) {
            this("image", media, caption);
        }
    }

    public record VideoContent(String type, MediaAttachmentDto media, OriginalTextDto caption) implements MessageContentDto {
        public VideoContent(MediaAttachmentDto media, OriginalTextDto caption) {
            this("video", media, caption);
        }
    }

    public record FileContent(String type, MediaAttachmentDto media, String fileName) implements MessageContentDto {
        public FileContent(MediaAttachmentDto media, String fileName) {
            this("file", media, fileName);
        }
    }

    public record StoryReplyContent(String type, UUID storyId, OriginalTextDto body) implements MessageContentDto {
        public StoryReplyContent(UUID storyId, OriginalTextDto body) {
            this("story_reply", storyId, body);
        }
    }

    /** A quick reaction to a story, sent as a direct message (PLAN.md §9.9). Never translated. */
    public record StoryReactionContent(String type, UUID storyId, String emoji) implements MessageContentDto {
        public StoryReactionContent(UUID storyId, String emoji) {
            this("story_reaction", storyId, emoji);
        }
    }

    public record MessageReferenceDto(UUID messageId, UUID senderId, String preview) {}

    public record ReactionSummaryDto(String emoji, int count, boolean reactedByMe) {}

    public record MessageDto(
            UUID id,
            String clientId,
            UUID conversationId,
            UUID senderId,
            MessageContentDto content,
            ContentTranslationDto translation,
            MessageReferenceDto replyTo,
            List<ReactionSummaryDto> reactions,
            String deliveryStatus,
            Instant createdAt) {}

    public record ConversationMemberDto(
            UserDto user, String role, String receivingLanguage, UUID lastReadMessageId, boolean isOnline, Instant lastSeenAt) {}

    public record ConversationDto(
            UUID id,
            String kind,
            String title,
            String avatarUrl,
            UUID createdBy,
            List<ConversationMemberDto> members,
            MessageDto lastMessage,
            int unreadCount,
            Instant mutedUntil,
            Instant updatedAt,
            /** Direct conversations only: why the viewer can't send right now (you_blocked, followers_only, unavailable), or null. */
            String sendRestriction) {}
}
