package com.tennotalk.chat;

import java.time.Instant;
import java.util.UUID;

public record ConversationRow(
        UUID id, String kind, String title, String avatarUrl, UUID createdBy, Instant createdAt, Instant updatedAt) {}
