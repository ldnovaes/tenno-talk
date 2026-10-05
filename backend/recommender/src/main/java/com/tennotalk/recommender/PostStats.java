package com.tennotalk.recommender;

/** Engagement counters of a post. Negative counts are clamped to zero. */
public record PostStats(long impressions, long likes, long comments, long shares, long hides, long dwellMsSum) {

    public static final PostStats EMPTY = new PostStats(0, 0, 0, 0, 0, 0);

    public PostStats {
        impressions = Safe.count(impressions);
        likes = Safe.count(likes);
        comments = Safe.count(comments);
        shares = Safe.count(shares);
        hides = Safe.count(hides);
        dwellMsSum = Safe.count(dwellMsSum);
    }

    /** Average visible time per impression, in seconds. */
    public double averageDwellSeconds() {
        return impressions == 0 ? 0 : dwellMsSum / 1000.0 / impressions;
    }
}
