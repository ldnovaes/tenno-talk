package com.tennotalk.stories;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.tennotalk.chat.ChatDtos.ContentTranslationDto;
import com.tennotalk.chat.ChatDtos.MediaAttachmentDto;
import com.tennotalk.chat.ChatDtos.OriginalTextDto;
import com.tennotalk.users.UserDtos.UserDto;

/** Mirrors src/types/story.ts. */
public final class StoryDtos {

    private StoryDtos() {}

    public record StoryDto(
            UUID id,
            UserDto author,
            MediaAttachmentDto media,
            OriginalTextDto overlayText,
            ContentTranslationDto overlayTranslation,
            Instant createdAt,
            Instant expiresAt,
            boolean viewedByMe) {}

    public record StoryTrayItemDto(UserDto user, List<StoryDto> stories, boolean hasUnseen) {}

    public record ReplyResult(UUID conversationId, com.tennotalk.chat.ChatDtos.MessageDto message) {}
}
