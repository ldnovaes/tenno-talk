package com.tennotalk.recommender;

import static com.tennotalk.recommender.Fixtures.VIEWER;
import static com.tennotalk.recommender.Fixtures.id;
import static com.tennotalk.recommender.Fixtures.post;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

/** The ordering used when even the safe ranking fails: newest first, still honoring the hard rules. */
class LastResortTest {

    private final Recommender recommender = Fixtures.core();

    @Test
    void newestFirstWithoutRepeatsOwnOrHiddenPosts() {
        Viewer viewer = Viewer.builder(VIEWER).hiddenPosts(List.of(id(3))).hiddenAuthors(List.of(id(40))).build();
        List<Candidate> candidates = Arrays.asList(
                post(1, 10, Duration.ofHours(5), 0),
                post(2, 20, Duration.ofHours(1), 0),
                post(2, 21, Duration.ofHours(9), 0), // repeated id: the first one wins
                post(3, 30, Duration.ofMinutes(1), 0), // hidden post
                post(4, 40, Duration.ofMinutes(2), 0), // hidden author
                post(5, 1_000_000, Duration.ofMinutes(3), 0), // own post
                post(6, 60, Duration.ofHours(1), 0), // same age as 2: id breaks the tie
                null,
                Candidate.builder(null, id(7)).build(),
                Candidate.builder(id(8), null).build());

        Ranking ranking = recommender.newestFirst(new RankRequest(viewer, candidates, 10, 0, Fixtures.NOW), 0, "test");

        assertThat(ranking.postIds()).containsExactly(id(2), id(6), id(1));
        assertThat(ranking.diagnostics().fallback()).isEqualTo("test");
        assertThat(ranking.diagnostics().eligible()).isEqualTo(3);
    }

    @Test
    void respectsTheLimit() {
        Ranking ranking = recommender.newestFirst(Fixtures.request(Fixtures.viewer(), Fixtures.posts(5), 2), 0, "test");
        assertThat(ranking.postIds()).containsExactly(id(1), id(2));
        assertThat(recommender.newestFirst(Fixtures.request(Fixtures.viewer(), Fixtures.posts(5), 0), 0, "test").items()).isEmpty();
    }
}
