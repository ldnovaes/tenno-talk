package com.tennotalk.recommender.learning;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Fixed topic taxonomy (PLAN.md §37.2). The AI classifier maps posts onto these codes, so affinities are
 * comparable across people and languages. Changing the list means a new {@link #VERSION} and reclassification.
 */
public final class Topics {

    public static final String VERSION = "2026-10-05";

    public static final List<String> ALL = List.of(
            "animals", "anime", "architecture", "art", "beauty", "books", "business", "cars", "career", "coffee",
            "comedy", "cooking", "crafts", "culture", "dance", "design", "diy", "education", "environment", "family",
            "fashion", "festivals", "finance", "fitness", "food", "gaming", "gardening", "health", "history", "home",
            "language-learning", "movies", "music", "nature", "nightlife", "outdoors", "parenting", "pets",
            "photography", "programming", "relationships", "science", "spirituality", "sports", "study-abroad",
            "technology", "travel", "tv", "volunteering", "writing");

    private static final Set<String> CODES = Set.copyOf(ALL);
    /** "languagelearning" (as a hashtag) → "language-learning". */
    private static final Map<String, String> BY_COMPACT = ALL.stream()
            .collect(Collectors.toUnmodifiableMap(code -> code.replace("-", ""), Function.identity()));

    private Topics() {}

    public static boolean isTopic(String code) {
        return code != null && CODES.contains(code);
    }

    /** The taxonomy code a hashtag names exactly ("#Travel", "#language_learning"), if any. */
    public static Optional<String> fromHashtag(String tag) {
        if (tag == null) return Optional.empty();
        String compact = tag.toLowerCase(Locale.ROOT).replace("_", "").replace("-", "");
        return Optional.ofNullable(BY_COMPACT.get(compact));
    }
}
