package com.tennotalk.feed;

import java.util.UUID;

/** Feed domain events, published inside the transaction and consumed after it commits. */
public final class FeedEvents {

    private FeedEvents() {}

    /** A new post; {@code caption} may be null. */
    public record PostCreated(UUID postId, UUID authorId, String caption) {}
}
