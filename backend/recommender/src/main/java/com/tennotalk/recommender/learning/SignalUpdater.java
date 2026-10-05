package com.tennotalk.recommender.learning;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import com.tennotalk.recommender.SparseVector;

/**
 * How interactions become interests (PLAN.md §37.5). Pure and total: the app's worker feeds it events and
 * stores the result. Affinities decay exponentially (half-life), so old tastes fade unless renewed.
 *
 * <p>Affinity keys: taxonomy topics and "tag:*" as they are, {@code author:<uuid>}, {@code country:<ISO>}.
 */
public final class SignalUpdater {

    public static final String AUTHOR_PREFIX = "author:";
    public static final String COUNTRY_PREFIX = "country:";
    /** Affinities stay within ±MAX, so one obsessive day cannot dominate forever. */
    public static final double MAX = 20;
    /** Visible time that counts as full attention; longer stays add nothing. */
    public static final long FULL_DWELL_MS = 15_000;
    /** Shorter than this is a skip. */
    public static final long SKIP_DWELL_MS = 1_500;
    public static final long MAX_DWELL_MS = 10 * 60_000;
    static final double COUNTRY_SHARE = 0.3;

    private final Duration halfLife;

    public SignalUpdater(Duration halfLife) {
        this.halfLife = halfLife == null || halfLife.isNegative() || halfLife.isZero() ? Duration.ofDays(14) : halfLife;
    }

    /** Strength of an interaction in [-5, 2]; {@code value} is the visible time in ms for DWELL. */
    public static double strength(InteractionKind kind, long value) {
        if (kind == null) return 0;
        return switch (kind) {
            case IMPRESSION -> 0;
            case DWELL -> {
                long ms = Math.clamp(value, 0, MAX_DWELL_MS);
                yield ms < SKIP_DWELL_MS ? -0.15 : 0.8 * Math.min(1, ms / (double) FULL_DWELL_MS);
            }
            case LIKE -> 1;
            case UNLIKE -> -1;
            case COMMENT -> 1.5;
            case SHARE, FOLLOW, MESSAGE_AUTHOR -> 2;
            case PROFILE_OPEN -> 0.5;
            case UNFOLLOW -> -2;
            case HIDE_POST -> -3;
            case HIDE_AUTHOR, REPORT -> -5;
        };
    }

    /**
     * Affinity changes caused by one interaction with a post. Topic changes are split by the post's topic
     * weights (L1), so a post with thirty hashtags does not count thirty times.
     */
    public static Map<String, Double> affinityDeltas(InteractionKind kind, long value, SparseVector postTopics, UUID author,
            String authorCountry) {
        double strength = strength(kind, value);
        Map<String, Double> deltas = new HashMap<>();
        if (strength == 0) return deltas;
        SparseVector topics = postTopics == null ? SparseVector.EMPTY : postTopics;
        double total = 0;
        for (double weight : topics.weights().values()) total += Math.abs(weight);
        if (total > 0) {
            for (Map.Entry<String, Double> topic : topics.weights().entrySet()) {
                deltas.put(topic.getKey(), strength * topic.getValue() / total);
            }
        }
        if (author != null) deltas.put(AUTHOR_PREFIX + author, strength);
        String country = authorCountry == null ? "" : authorCountry.strip().toUpperCase(Locale.ROOT);
        if (!country.isEmpty()) deltas.put(COUNTRY_PREFIX + country, strength * COUNTRY_SHARE);
        return deltas;
    }

    /** Counter changes for {@code post_stats}. */
    public static StatsDelta statsDelta(InteractionKind kind, long value) {
        if (kind == null) return StatsDelta.NONE;
        return switch (kind) {
            case IMPRESSION -> new StatsDelta(1, 0, 0, 0, 0, 0);
            case DWELL -> new StatsDelta(0, 0, 0, 0, 0, Math.clamp(value, 0, MAX_DWELL_MS));
            case LIKE -> new StatsDelta(0, 1, 0, 0, 0, 0);
            case UNLIKE -> new StatsDelta(0, -1, 0, 0, 0, 0);
            case COMMENT -> new StatsDelta(0, 0, 1, 0, 0, 0);
            case SHARE -> new StatsDelta(0, 0, 0, 1, 0, 0);
            case HIDE_POST, REPORT -> new StatsDelta(0, 0, 0, 0, 1, 0);
            case PROFILE_OPEN, FOLLOW, UNFOLLOW, MESSAGE_AUTHOR, HIDE_AUTHOR -> StatsDelta.NONE;
        };
    }

    /** {@code score} as it is at {@code at}, having last been written at {@code updatedAt}. */
    public double decayed(double score, Instant updatedAt, Instant at) {
        if (!Double.isFinite(score)) return 0;
        if (updatedAt == null || at == null || !at.isAfter(updatedAt)) return clamp(score);
        return clamp(score * factor(Duration.between(updatedAt, at)));
    }

    /**
     * New stored score after adding {@code delta} that happened at {@code eventAt}. Events may arrive out of
     * order: an event older than the stored score is decayed to the stored time instead.
     *
     * @return the score, valid as of {@link #storedAt}
     */
    public double apply(double score, Instant updatedAt, double delta, Instant eventAt) {
        double safeDelta = Double.isFinite(delta) ? delta : 0;
        if (updatedAt == null) return clamp((Double.isFinite(score) ? score : 0) + safeDelta);
        if (eventAt == null || !eventAt.isAfter(updatedAt)) {
            Duration late = eventAt == null ? Duration.ZERO : Duration.between(eventAt, updatedAt);
            return clamp((Double.isFinite(score) ? score : 0) + safeDelta * factor(late));
        }
        return clamp(decayed(score, updatedAt, eventAt) + safeDelta);
    }

    /** When the result of {@link #apply} is valid: the later of the two instants. */
    public static Instant storedAt(Instant updatedAt, Instant eventAt) {
        if (updatedAt == null) return eventAt;
        if (eventAt == null) return updatedAt;
        return eventAt.isAfter(updatedAt) ? eventAt : updatedAt;
    }

    private double factor(Duration elapsed) {
        double halves = elapsed.toMillis() / (double) halfLife.toMillis();
        return Math.pow(2, -Math.max(0, halves));
    }

    private static double clamp(double score) {
        if (!Double.isFinite(score)) return 0;
        return Math.max(-MAX, Math.min(MAX, score));
    }
}
