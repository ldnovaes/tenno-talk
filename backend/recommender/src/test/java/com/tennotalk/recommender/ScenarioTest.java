package com.tennotalk.recommender;

import static com.tennotalk.recommender.Fixtures.NOW;
import static com.tennotalk.recommender.Fixtures.VIEWER;
import static com.tennotalk.recommender.Fixtures.id;
import static com.tennotalk.recommender.Fixtures.post;
import static com.tennotalk.recommender.Fixtures.postBuilder;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

/** The product behavior the v1 ranking promises (PLAN.md §37), on small named situations. */
class ScenarioTest {

    private final Recommender recommender = Fixtures.standard();

    private List<UUID> rank(Viewer viewer, List<Candidate> candidates) {
        return recommender.rank(new RankRequest(viewer, candidates, candidates.size(), 1, NOW)).postIds();
    }

    private static Candidate aged(int post, int author, int hours) {
        return post(post, author, Duration.ofHours(hours), 1_000);
    }

    @Test
    void coldStartViewerSeesTheLanguageTheyLearnFirst() {
        Viewer newcomer = Viewer.builder(VIEWER).nativeLanguage("pt-BR").learningLanguages(List.of("ja")).build();
        List<Candidate> candidates = List.of(
                postBuilder(1, 11).language("en").build(), postBuilder(2, 12).language("en").build(),
                postBuilder(3, 13).language("ja").build(), postBuilder(4, 14).language("vi").build());

        assertThat(rank(newcomer, candidates).getFirst()).isEqualTo(id(3));
    }

    @Test
    void someoneLearningMyLanguageIsAGoodMatch() {
        Viewer viewer = Viewer.builder(VIEWER).nativeLanguage("pt").build();
        List<Candidate> candidates = List.of(postBuilder(1, 11).build(), postBuilder(2, 12).authorLearningLanguages(List.of("pt-BR")).build());

        assertThat(rank(viewer, candidates).getFirst()).isEqualTo(id(2));
    }

    @Test
    void aStrongInterestBeatsAFewHoursOfFreshness() {
        Viewer traveler = Viewer.builder(VIEWER).topics(Map.of("travel", 5.0)).build();
        Candidate oldTravel = Candidate.builder(id(1), id(11)).createdAt(NOW.minus(Duration.ofHours(10)))
                .topics(Map.of("travel", 1.0)).stats(new PostStats(1_000, 0, 0, 0, 0, 0)).build();
        Candidate newFood = Candidate.builder(id(2), id(12)).createdAt(NOW.minus(Duration.ofHours(1)))
                .topics(Map.of("food", 1.0)).stats(new PostStats(1_000, 0, 0, 0, 0, 0)).build();

        assertThat(rank(traveler, List.of(newFood, oldTravel))).containsExactly(id(1), id(2));
    }

    @Test
    void aFollowedAuthorComesBeforeAStranger() {
        Viewer viewer = Viewer.builder(VIEWER).following(List.of(id(12))).build();
        assertThat(rank(viewer, List.of(aged(1, 11, 1), aged(2, 12, 3))).getFirst()).isEqualTo(id(2));
    }

    @Test
    void aHiddenAuthorNeverAppearsEvenWhenPerfect() {
        Viewer viewer = Viewer.builder(VIEWER).following(List.of(id(12))).hiddenAuthors(List.of(id(12)))
                .topics(Map.of("travel", 5.0)).build();
        Candidate perfect = postBuilder(2, 12).topics(Map.of("travel", 1.0)).build();

        assertThat(rank(viewer, List.of(aged(1, 11, 1), perfect))).containsExactly(id(1));
    }

    @Test
    void alreadySeenPostsWaitBehindNewOnes() {
        Viewer viewer = Viewer.builder(VIEWER).seen(List.of(id(1))).build();
        assertThat(rank(viewer, List.of(aged(1, 11, 1), aged(2, 12, 5)))).containsExactly(id(2), id(1));
    }

    @Test
    void aPostManyPeopleHideSinks() {
        Candidate disliked = postBuilder(1, 11).stats(new PostStats(100, 0, 0, 0, 40, 0)).build();
        Candidate fine = Candidate.builder(id(2), id(12)).createdAt(NOW.minus(Duration.ofHours(6)))
                .stats(new PostStats(100, 0, 0, 0, 0, 0)).build();

        assertThat(rank(Fixtures.viewer(), List.of(disliked, fine))).containsExactly(id(2), id(1));
    }

    @Test
    void aProlificAuthorDoesNotFillTheScreen() {
        List<Candidate> candidates = new ArrayList<>();
        for (int i = 0; i < 8; i++) candidates.add(postBuilder(i + 1, 11).stats(new PostStats(1_000, 900, 0, 0, 0, 0)).build());
        for (int i = 0; i < 8; i++) candidates.add(aged(100 + i, 200 + i, 10));

        List<UUID> ids = rank(Fixtures.viewer(), candidates);
        Set<UUID> firstFourAuthors = new HashSet<>();
        for (UUID post : ids.subList(0, 4)) firstFourAuthors.add(candidates.stream().filter(c -> c.postId().equals(post)).findFirst().orElseThrow().authorId());

        assertThat(firstFourAuthors).hasSize(4);
    }

    @Test
    void aBrandNewPostWithNoSignalsStillMakesTheFirstPage() {
        Viewer traveler = Viewer.builder(VIEWER).topics(Map.of("travel", 5.0)).following(List.of(id(11))).build();
        List<Candidate> candidates = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            candidates.add(Candidate.builder(id(i + 1), id(11 + i % 3)).createdAt(NOW.minus(Duration.ofHours(1)))
                    .topics(Map.of("travel", 1.0)).stats(new PostStats(1_000, 500, 50, 10, 0, 0)).build());
        }
        Candidate lonely = Candidate.builder(id(999), id(77)).createdAt(NOW.minus(Duration.ofHours(20))).language("xx")
                .topics(Map.of("knitting", 1.0)).build();
        candidates.add(lonely);

        List<UUID> firstPage = recommender.rank(new RankRequest(traveler, candidates, 10, 1, NOW)).postIds();

        assertThat(firstPage).contains(id(999));
    }

    @Test
    void sessionsDifferButEachSessionIsReproducible() {
        List<Candidate> candidates = new ArrayList<>();
        for (int i = 0; i < 40; i++) candidates.add(aged(i + 1, 100 + i, 5));
        Set<List<UUID>> orders = new HashSet<>();
        for (long seed = 0; seed < 5; seed++) {
            List<UUID> order = recommender.rank(new RankRequest(Fixtures.viewer(), candidates, 40, seed, NOW)).postIds();
            assertThat(recommender.rank(new RankRequest(Fixtures.viewer(), candidates, 40, seed, NOW)).postIds()).isEqualTo(order);
            orders.add(order);
        }
        assertThat(orders).hasSizeGreaterThan(1);
    }

    @Test
    void peopleLikeMeLikedItSoItRises() {
        Viewer viewer = Viewer.builder(VIEWER).neighborEngagement(Map.of(id(2), 3.0)).build();
        assertThat(rank(viewer, List.of(aged(1, 11, 1), aged(2, 12, 3))).getFirst()).isEqualTo(id(2));
    }

    @Test
    void myOwnPostsAreNotDiscovered() {
        assertThat(rank(Fixtures.viewer(), List.of(post(1, 1_000_000), aged(2, 12, 1)))).containsExactly(id(2));
    }
}
