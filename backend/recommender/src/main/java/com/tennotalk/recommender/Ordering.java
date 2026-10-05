package com.tennotalk.recommender;

import java.util.Comparator;

/** Display order: higher score first; ties go to the newer post, then to the post id (stable and deterministic). */
final class Ordering {

    static final Comparator<Ranked> BY_SCORE = Comparator.comparingDouble(Ranked::score).reversed()
            .thenComparing((Ranked ranked) -> ranked.candidate().createdAt(), Comparator.reverseOrder())
            .thenComparing(Ranked::postId);

    private Ordering() {}
}
