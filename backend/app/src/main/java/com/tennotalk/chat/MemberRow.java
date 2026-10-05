package com.tennotalk.chat;

import java.time.Instant;
import java.util.UUID;

import com.tennotalk.users.UserDtos.UserDto;

/** A member with its cursors resolved to timestamps (for ticks and unread counts). */
public record MemberRow(
        UUID conversationId,
        UserDto user,
        String role,
        String receivingLanguage,
        UUID lastReadMessageId,
        Instant lastReadAt,
        Instant lastDeliveredAt,
        Instant mutedUntil,
        Instant lastSeenAt) {}
