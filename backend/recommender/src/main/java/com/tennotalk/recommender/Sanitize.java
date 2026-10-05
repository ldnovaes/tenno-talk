package com.tennotalk.recommender;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Drops null candidates, candidates without ids and repeated posts (the first one wins). */
final class Sanitize {

    private Sanitize() {}

    static List<Candidate> apply(List<Candidate> candidates) {
        List<Candidate> result = new ArrayList<>(candidates.size());
        Set<UUID> seen = new HashSet<>();
        for (Candidate candidate : candidates) {
            if (candidate != null && candidate.hasIds() && seen.add(candidate.postId())) result.add(candidate);
        }
        return result;
    }
}
