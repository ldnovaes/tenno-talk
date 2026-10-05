package com.tennotalk.recommender;

import java.util.Map;
import java.util.UUID;

/**
 * A ranked post.
 *
 * @param exposure      placed in a slot reserved for under-exposed posts (§37.3)
 * @param contributions signal name → score added (only when the request asked to explain)
 */
public record Ranked(Candidate candidate, double score, boolean exposure, Map<String, Double> contributions) {

    public Ranked {
        contributions = contributions == null ? Map.of() : Map.copyOf(contributions);
    }

    public UUID postId() {
        return candidate.postId();
    }

    public UUID authorId() {
        return candidate.authorId();
    }

    Ranked asExposure() {
        return exposure ? this : new Ranked(candidate, score, true, contributions);
    }
}
