package com.tennotalk.notifications;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.tennotalk.users.UserDtos.UserDto;

/** Flattened form of the frontend Notification union (absent fields are omitted). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record NotificationDto(
        UUID id,
        String type,
        UserDto actor,
        Instant createdAt,
        @JsonInclude(JsonInclude.Include.ALWAYS) Instant readAt,
        UUID postId,
        UUID commentId,
        UUID storyId,
        String emoji,
        UUID conversationId,
        UUID messageId) {}
