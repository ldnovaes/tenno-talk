package com.tennotalk.chat;

import java.util.UUID;

/** Domain events, dispatched to sockets after the transaction commits. */
public final class ChatEvents {

    private ChatEvents() {}

    public record MessageCreated(UUID conversationId, UUID messageId) {}

    public record MessageUpdated(UUID conversationId, UUID messageId) {}

    public record TranslationChanged(UUID conversationId, UUID messageId, String targetLanguage) {}

    public record ReceiptChanged(UUID conversationId, UUID userId, String receipt, UUID upToMessageId) {}

    public record ReactionChanged(UUID conversationId, UUID messageId, UUID userId, String emoji, boolean added) {}
}
