package com.tennotalk.recommender;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Last gate of the core: the output holds exactly min(limit, eligible) distinct eligible posts with finite
 * scores. A violation means a bug somewhere above; the caller then returns the safe ranking.
 */
final class InvariantCheck {

    private InvariantCheck() {}

    static boolean holds(List<Candidate> eligible, List<Ranked> output, int limit) {
        if (output == null || output.size() != Math.min(limit, eligible.size())) return false;
        Set<UUID> allowed = new HashSet<>();
        for (Candidate candidate : eligible) allowed.add(candidate.postId());
        Set<UUID> seen = new HashSet<>();
        for (Ranked ranked : output) {
            if (ranked == null || ranked.candidate() == null) return false;
            if (!allowed.contains(ranked.postId()) || !seen.add(ranked.postId())) return false;
            if (!Double.isFinite(ranked.score())) return false;
        }
        return true;
    }
}
