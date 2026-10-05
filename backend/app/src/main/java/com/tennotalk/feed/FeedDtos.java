package com.tennotalk.feed;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.tennotalk.chat.ChatDtos.ContentTranslationDto;
import com.tennotalk.chat.ChatDtos.MediaAttachmentDto;
import com.tennotalk.chat.ChatDtos.OriginalTextDto;
import com.tennotalk.users.UserDtos.UserDto;

/** Mirrors src/types/post.ts. */
public final class FeedDtos {

    private FeedDtos() {}

    public record PostDto(
            UUID id,
            UserDto author,
            List<MediaAttachmentDto> media,
            OriginalTextDto caption,
            ContentTranslationDto captionTranslation,
            long likesCount,
            long commentsCount,
            boolean likedByMe,
            Instant createdAt) {}

    public record CommentDto(UUID id, UUID postId, UserDto author, OriginalTextDto body, ContentTranslationDto translation,
            Instant createdAt) {}
}
