package com.tennotalk.realtime;

import java.util.UUID;

public record TypingReceived(UUID userId, UUID conversationId, boolean typing) {}
