package com.tennotalk.chat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Receiving language of each user over time (PLAN.md §21): a message is shown in the language
 * its reader had when it was sent, so changing the language never translates the past again.
 */
public record ReceivingLanguages(Map<UUID, List<Period>> periods) {

    /** From {@code since} on, the user receives in {@code language}. Lists are sorted by {@code since}. */
    public record Period(String language, Instant since) {}

    public static final ReceivingLanguages NONE = new ReceivingLanguages(Map.of());

    /** The language in effect at {@code when}, or null when the history does not cover it. */
    public String at(UUID userId, Instant when) {
        String language = null;
        for (Period period : periods.getOrDefault(userId, List.of())) {
            if (period.since().isAfter(when)) break;
            language = period.language();
        }
        return language;
    }

    /** What this member received at {@code when}; their current language when the history has no answer. */
    public String of(MemberRow member, Instant when) {
        String then = at(member.user().id(), when);
        return then != null ? then : member.receivingLanguage();
    }
}
