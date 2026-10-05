package com.tennotalk.recommender;

import java.util.ArrayList;
import java.util.List;

/**
 * Rules no signal can override: the viewer's own posts, posts marked "not interested" and hidden authors
 * never appear. Visibility (blocks, private profiles) is enforced by the caller's query; this is defense in depth.
 */
final class HardFilter {

    private HardFilter() {}

    static List<Candidate> apply(Viewer viewer, List<Candidate> candidates) {
        List<Candidate> result = new ArrayList<>(candidates.size());
        for (Candidate candidate : candidates) {
            if (candidate.authorId().equals(viewer.id())) continue;
            if (viewer.hiddenPosts().contains(candidate.postId())) continue;
            if (viewer.hiddenAuthors().contains(candidate.authorId())) continue;
            result.add(candidate);
        }
        return result;
    }
}
