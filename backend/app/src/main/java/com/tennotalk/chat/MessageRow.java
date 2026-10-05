package com.tennotalk.chat;

import java.time.Instant;
import java.util.UUID;

public record MessageRow(
        UUID id,
        UUID conversationId,
        UUID senderId,
        String clientId,
        String type,
        String originalText,
        String originalLanguage,
        UUID replyToId,
        UUID storyId,
        Instant createdAt) {}
