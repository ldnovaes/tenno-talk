package com.tennotalk.recommender;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Exposure guarantee (PLAN.md §37.3): k of every n positions go to under-exposed posts, whatever their score.
 * Among them, the fewest impressions come first (in buckets, so relevance still orders posts with similar
 * exposure) and authors take turns, so no new post starves and no author takes every reserved slot.
 * Not a decorator: it is part of the frozen core and runs after every reranker.
 */
final class ExposureFloor {

    private static final int BUCKETS = 5;

    private final boolean[] reserved;
    private final int minImpressions;
    private final long windowMillis;
    private final long bucketSize;

    ExposureFloor(RecommenderConfig config) {
        int block = config.exposureBlock();
        int slots = config.exposureSlots();
        this.reserved = new boolean[block];
        // Spread the reserved slots over the block: k = 2, n = 10 → positions 3 and 6.
        for (int j = 1; j <= slots; j++) reserved[j * block / (slots + 1)] = true;
        this.minImpressions = config.minImpressions();
        this.windowMillis = config.exposureWindow().toMillis();
        this.bucketSize = Math.max(1, (long) Math.ceil(minImpressions / (double) BUCKETS));
    }

    boolean underExposed(Candidate candidate, Instant now) {
        long age = now.toEpochMilli() - candidate.createdAt().toEpochMilli();
        return candidate.stats().impressions() < minImpressions && age < windowMillis;
    }

    /** {@code ordered} is in display order; returns the same posts with the reserved slots filled. */
    List<Ranked> apply(List<Ranked> ordered, Instant now) {
        Deque<Ranked> needy = new ArrayDeque<>(turnsByAuthor(ordered.stream().filter(r -> underExposed(r.candidate(), now)).toList()));
        if (needy.isEmpty()) return ordered;
        List<Ranked> result = new ArrayList<>(ordered.size());
        Set<UUID> placed = new HashSet<>();
        int main = 0;
        for (int position = 0; position < ordered.size(); position++) {
            if (reserved[position % reserved.length]) {
                Ranked next = pollUnplaced(needy, placed);
                if (next != null) {
                    result.add(next.asExposure());
                    placed.add(next.postId());
                    continue;
                }
            }
            while (placed.contains(ordered.get(main).postId())) main++;
            Ranked next = ordered.get(main++);
            result.add(next);
            placed.add(next.postId());
        }
        return result;
    }

    private static Ranked pollUnplaced(Deque<Ranked> queue, Set<UUID> placed) {
        while (!queue.isEmpty()) {
            Ranked next = queue.pollFirst();
            if (!placed.contains(next.postId())) return next;
        }
        return null;
    }

    /** Fewest impressions first (bucketed), then score; then authors alternate inside that order. */
    private List<Ranked> turnsByAuthor(List<Ranked> needy) {
        List<Ranked> sorted = new ArrayList<>(needy);
        sorted.sort(Comparator.comparingLong((Ranked r) -> r.candidate().stats().impressions() / bucketSize)
                .thenComparing(Ordering.BY_SCORE));
        Map<UUID, Deque<Ranked>> byAuthor = new LinkedHashMap<>();
        for (Ranked ranked : sorted) byAuthor.computeIfAbsent(ranked.authorId(), author -> new ArrayDeque<>()).add(ranked);
        List<Ranked> result = new ArrayList<>(sorted.size());
        while (result.size() < sorted.size()) {
            for (Deque<Ranked> queue : byAuthor.values()) {
                Ranked next = queue.pollFirst();
                if (next != null) result.add(next);
            }
        }
        return result;
    }
}
