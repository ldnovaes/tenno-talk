package com.tennotalk.recommender.learning;

/** Change to a post's counters caused by one interaction (may be negative: an unlike). */
public record StatsDelta(long impressions, long likes, long comments, long shares, long hides, long dwellMs) {

    public static final StatsDelta NONE = new StatsDelta(0, 0, 0, 0, 0, 0);

    public boolean isNone() {
        return equals(NONE);
    }
}
