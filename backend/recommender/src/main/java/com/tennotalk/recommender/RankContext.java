package com.tennotalk.recommender;

import java.time.Instant;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.LongSupplier;

/**
 * State of one ranking call. Decorators read the viewer, the time and the noise; the core uses the rest
 * to account for each signal. Not thread-safe: a ranking call runs on one thread.
 */
public final class RankContext {

    private final Viewer viewer;
    private final Instant now;
    private final long seed;
    private final double cap;
    private final LongSupplier ticker;
    private final Set<String> disabled;
    private final Map<String, Integer> slots = new HashMap<>();
    private final double[] contributions;
    private final long[] nanos;
    private final Map<String, Integer> failures = new HashMap<>();

    RankContext(Viewer viewer, Instant now, long seed, double cap, LongSupplier ticker, List<String> signals, Set<String> disabled) {
        this.viewer = viewer;
        this.now = now;
        this.seed = seed;
        this.cap = cap;
        this.ticker = ticker;
        this.disabled = disabled;
        for (String signal : signals) slots.put(signal, slots.size());
        this.contributions = new double[slots.size()];
        this.nanos = new long[slots.size()];
    }

    public Viewer viewer() {
        return viewer;
    }

    public Instant now() {
        return now;
    }

    /** Deterministic noise in [0, 1) for this (request seed, post) pair. */
    public double noise(UUID post) {
        long mixed = seed;
        if (post != null) mixed ^= post.getMostSignificantBits() * 0x9E3779B97F4A7C15L ^ post.getLeastSignificantBits();
        return (splitMix(mixed) >>> 11) * 0x1.0p-53;
    }

    // ---- core accounting (package-private) -------------------------------

    boolean enabled(String signal) {
        return !disabled.contains(signal) && slots.containsKey(signal);
    }

    double cap() {
        return cap;
    }

    long tick() {
        return ticker.getAsLong();
    }

    void beginCandidate() {
        Arrays.fill(contributions, 0);
    }

    void contribute(String signal, double delta) {
        contributions[slots.get(signal)] = delta;
    }

    void spent(String signal, long elapsed) {
        Integer slot = slots.get(signal);
        if (slot != null) nanos[slot] += Math.max(0, elapsed);
    }

    void failed(String signal) {
        failures.merge(signal, 1, Integer::sum);
    }

    /** Contributions of the current candidate, in signal order. */
    double[] contributions() {
        return contributions.clone();
    }

    int slot(String signal) {
        Integer slot = slots.get(signal);
        return slot == null ? -1 : slot;
    }

    long nanos(String signal) {
        int slot = slot(signal);
        return slot < 0 ? 0 : nanos[slot];
    }

    Map<String, Integer> failures() {
        return Map.copyOf(failures);
    }

    Set<String> disabled() {
        return disabled;
    }

    private static long splitMix(long value) {
        long z = value + 0x9E3779B97F4A7C15L;
        z = (z ^ (z >>> 30)) * 0xBF58476D1CE4E5B9L;
        z = (z ^ (z >>> 27)) * 0x94D049BB133111EBL;
        return z ^ (z >>> 31);
    }
}
