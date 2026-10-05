package com.tennotalk.recommender;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * One ranking call.
 *
 * @param limit   maximum number of posts returned (negative = 0)
 * @param seed    makes exploration noise reproducible (use one per discover session)
 * @param explain when true, every {@link Ranked} carries the contribution of each signal
 */
public record RankRequest(Viewer viewer, List<Candidate> candidates, int limit, long seed, Instant now, boolean explain) {

    public RankRequest {
        viewer = viewer == null ? Viewer.anonymous(null) : viewer;
        // Copy keeping null elements: Sanitize drops them, and List.copyOf would throw.
        candidates = candidates == null ? List.of() : Collections.unmodifiableList(new ArrayList<>(candidates));
        limit = Math.max(0, limit);
        now = Safe.instant(now, Instant.now());
    }

    public RankRequest(Viewer viewer, List<Candidate> candidates, int limit, long seed, Instant now) {
        this(viewer, candidates, limit, seed, now, false);
    }
}
