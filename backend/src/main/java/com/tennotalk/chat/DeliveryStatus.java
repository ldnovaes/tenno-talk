package com.tennotalk.chat;

import java.time.Instant;
import java.util.List;

/**
 * Ticks are derived from the other members' cursors, never stored per message
 * (PLAN.md §27): read ≥ delivered ≥ sent.
 */
public final class DeliveryStatus {

    /** When the cursors of one other member point (createdAt of the cursor message, or null). */
    public record MemberCursor(Instant delivered, Instant read) {}

    private DeliveryStatus() {}

    public static String derive(Instant messageCreatedAt, List<MemberCursor> others) {
        if (others.isEmpty()) return "sent";
        boolean allRead = others.stream().allMatch(cursor -> reached(cursor.read(), messageCreatedAt));
        if (allRead) return "read";
        boolean allDelivered = others.stream()
                .allMatch(cursor -> reached(cursor.delivered(), messageCreatedAt) || reached(cursor.read(), messageCreatedAt));
        return allDelivered ? "delivered" : "sent";
    }

    private static boolean reached(Instant cursor, Instant messageCreatedAt) {
        return cursor != null && !cursor.isBefore(messageCreatedAt);
    }
}
