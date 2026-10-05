package com.tennotalk.recommender;

import static com.tennotalk.recommender.Fixtures.NOW;
import static com.tennotalk.recommender.Fixtures.id;
import static com.tennotalk.recommender.Fixtures.post;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

/** The exposure guarantee (PLAN.md §37.3): k of every n positions go to under-exposed posts. */
class ExposureFloorTest {

    private final RecommenderConfig config = RecommenderConfig.defaults(); // 2 of 10, < 50 impressions, < 72 h
    private final ExposureFloor floor = new ExposureFloor(config);

    private static Ranked ranked(Candidate candidate, double score) {
        return new Ranked(candidate, score, false, null);
    }

    /** {@code count} well-exposed posts with decreasing scores. */
    private static List<Ranked> popular(int count) {
        List<Ranked> result = new ArrayList<>();
        for (int i = 0; i < count; i++) result.add(ranked(post(i + 1, 500 + i), 100 - i));
        return result;
    }

    private static Candidate fresh(int post, int author, long impressions) {
        return post(post, author, Duration.ofHours(1), impressions);
    }

    @Test
    void reservedSlotsAreSpreadOverTheBlock() {
        List<Ranked> ordered = new ArrayList<>(popular(18));
        ordered.add(ranked(fresh(901, 1, 0), -10));
        ordered.add(ranked(fresh(902, 2, 0), -11));
        ordered.add(ranked(fresh(903, 3, 0), -12));
        ordered.add(ranked(fresh(904, 4, 0), -13));

        List<Ranked> result = floor.apply(ordered, NOW);

        List<Integer> exposurePositions = IntStream.range(0, result.size()).filter(i -> result.get(i).exposure()).boxed().toList();
        assertThat(exposurePositions).containsExactly(3, 6, 13, 16);
        assertThat(result.get(3).postId()).isEqualTo(id(901));
        assertThat(result.get(6).postId()).isEqualTo(id(902));
        assertThat(result).extracting(Ranked::postId).doesNotHaveDuplicates().hasSize(ordered.size());
    }

    @Test
    void withoutUnderExposedPostsTheOrderIsUntouched() {
        List<Ranked> ordered = popular(25);
        assertThat(floor.apply(ordered, NOW)).isEqualTo(ordered);
    }

    @Test
    void anUnderExposedPostAlreadyAboveItsSlotStaysWhereItIs() {
        List<Ranked> ordered = new ArrayList<>(popular(9));
        ordered.add(0, ranked(fresh(901, 1, 0), 1_000));

        List<Ranked> result = floor.apply(ordered, NOW);

        assertThat(result.get(0).postId()).isEqualTo(id(901));
        assertThat(result).extracting(Ranked::postId).doesNotHaveDuplicates().hasSize(10);
    }

    @Test
    void fewestImpressionsComeFirstAcrossBuckets() {
        List<Ranked> ordered = new ArrayList<>(popular(10));
        ordered.add(ranked(fresh(901, 1, 40), 50)); // better score, many impressions
        ordered.add(ranked(fresh(902, 2, 0), -50)); // worse score, never seen

        List<Ranked> result = floor.apply(ordered, NOW);

        assertThat(result.get(3).postId()).isEqualTo(id(902));
        assertThat(result.get(6).postId()).isEqualTo(id(901));
    }

    @Test
    void withinABucketTheBetterScoreWins() {
        List<Ranked> ordered = new ArrayList<>(popular(10));
        ordered.add(ranked(fresh(901, 1, 1), -50));
        ordered.add(ranked(fresh(902, 2, 3), -10));

        assertThat(floor.apply(ordered, NOW).get(3).postId()).isEqualTo(id(902));
    }

    @Test
    void authorsTakeTurnsInTheReservedSlots() {
        List<Ranked> ordered = new ArrayList<>(popular(30));
        for (int i = 0; i < 5; i++) ordered.add(ranked(fresh(900 + i, 1, 0), -i)); // prolific author
        ordered.add(ranked(fresh(950, 2, 0), -100));

        List<Ranked> result = floor.apply(ordered, NOW);

        assertThat(result.get(3).authorId()).isEqualTo(id(1));
        assertThat(result.get(6).authorId()).isEqualTo(id(2));
    }

    @Test
    void oldOrWellSeenPostsAreNotUnderExposed() {
        assertThat(floor.underExposed(post(1, 1, Duration.ofHours(71), 49), NOW)).isTrue();
        assertThat(floor.underExposed(post(1, 1, Duration.ofHours(72), 0), NOW)).isFalse();
        assertThat(floor.underExposed(post(1, 1, Duration.ofHours(1), 50), NOW)).isFalse();
        assertThat(floor.underExposed(post(1, 1, Duration.ofHours(-5), 0), NOW)).isTrue(); // clock skew: from the future
    }

    @Test
    void zeroSlotsDisableTheFloor() {
        ExposureFloor off = new ExposureFloor(Fixtures.withoutExposure(config));
        List<Ranked> ordered = new ArrayList<>(popular(10));
        ordered.add(ranked(fresh(901, 1, 0), -10));
        assertThat(off.apply(ordered, NOW)).isEqualTo(ordered);
    }

    @Test
    void almostEveryPositionReservedWhenTheBlockAllows() {
        ExposureFloor greedy = new ExposureFloor(Fixtures.withExposure(config, 9, 10, 50));
        List<Ranked> ordered = new ArrayList<>(popular(3));
        for (int i = 0; i < 7; i++) ordered.add(ranked(fresh(900 + i, 900 + i, 0), -i));

        List<Ranked> result = greedy.apply(ordered, NOW);

        assertThat(result.get(0).postId()).isEqualTo(id(1)); // offset 0 is never reserved
        assertThat(result.subList(1, 8)).allMatch(Ranked::exposure);
        assertThat(result).extracting(Ranked::postId).doesNotHaveDuplicates().hasSize(10);
    }

    @Test
    void theRankingReportsExposureSlots() {
        List<Candidate> candidates = new ArrayList<>(Fixtures.posts(20));
        candidates.add(post(901, 1, Duration.ofHours(30), 0)); // under-exposed but older than most: ranks low on its own

        Ranking ranking = Fixtures.core().rank(Fixtures.request(Fixtures.viewer(), candidates, 21));

        assertThat(ranking.postIds().indexOf(id(901))).isEqualTo(3);
        assertThat(ranking.diagnostics().exposureSlots()).isEqualTo(1);
        assertThat(ranking.items().get(3).exposure()).isTrue();
    }
}
