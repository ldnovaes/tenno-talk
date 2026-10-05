package com.tennotalk.recommender.learning;

import static com.tennotalk.recommender.Fixtures.NOW;
import static com.tennotalk.recommender.Fixtures.id;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import com.tennotalk.recommender.SparseVector;

import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.DoubleRange;
import net.jqwik.api.constraints.LongRange;
import net.jqwik.api.constraints.Size;

class SignalUpdaterTest {

    private final SignalUpdater updater = new SignalUpdater(Duration.ofDays(14));

    @Test
    void strengthsOrderTheInteractions() {
        assertThat(SignalUpdater.strength(InteractionKind.HIDE_AUTHOR, 0)).isLessThan(SignalUpdater.strength(InteractionKind.HIDE_POST, 0));
        assertThat(SignalUpdater.strength(InteractionKind.HIDE_POST, 0)).isLessThan(SignalUpdater.strength(InteractionKind.UNLIKE, 0));
        assertThat(SignalUpdater.strength(InteractionKind.LIKE, 0)).isLessThan(SignalUpdater.strength(InteractionKind.COMMENT, 0));
        assertThat(SignalUpdater.strength(InteractionKind.COMMENT, 0)).isLessThan(SignalUpdater.strength(InteractionKind.FOLLOW, 0));
        assertThat(SignalUpdater.strength(InteractionKind.IMPRESSION, 0)).isZero();
        assertThat(SignalUpdater.strength(null, 0)).isZero();
    }

    @Test
    void dwellRewardsAttentionAndPunishesSkips() {
        assertThat(SignalUpdater.strength(InteractionKind.DWELL, 500)).isNegative();
        assertThat(SignalUpdater.strength(InteractionKind.DWELL, 1_499)).isNegative();
        assertThat(SignalUpdater.strength(InteractionKind.DWELL, 1_500)).isCloseTo(0.08, within(1e-12));
        assertThat(SignalUpdater.strength(InteractionKind.DWELL, 7_500)).isCloseTo(0.4, within(1e-12));
        assertThat(SignalUpdater.strength(InteractionKind.DWELL, 15_000)).isCloseTo(0.8, within(1e-12));
        assertThat(SignalUpdater.strength(InteractionKind.DWELL, Long.MAX_VALUE)).isCloseTo(0.8, within(1e-12));
        assertThat(SignalUpdater.strength(InteractionKind.DWELL, -5)).isNegative();
    }

    @ParameterizedTest
    @EnumSource(InteractionKind.class)
    void everyKindHasAStrengthWithinBoundsAndACode(InteractionKind kind) {
        assertThat(SignalUpdater.strength(kind, 10_000)).isBetween(-5.0, 2.0);
        assertThat(InteractionKind.fromCode(kind.code())).contains(kind);
        assertThat(InteractionKind.fromCode(" " + kind.code().toUpperCase() + " ")).contains(kind);
    }

    @Test
    void unknownCodesAreRejected() {
        assertThat(InteractionKind.fromCode("superlike")).isEmpty();
        assertThat(InteractionKind.fromCode(null)).isEmpty();
    }

    @Test
    void topicDeltasAreSplitAcrossThePostTopics() {
        SparseVector topics = SparseVector.of(Map.of("travel", 1.0, "tag:tokyo", 1.0, "food", 2.0));
        Map<String, Double> deltas = SignalUpdater.affinityDeltas(InteractionKind.LIKE, 0, topics, id(7), " jp ");

        assertThat(deltas.get("travel")).isCloseTo(0.25, within(1e-12));
        assertThat(deltas.get("tag:tokyo")).isCloseTo(0.25, within(1e-12));
        assertThat(deltas.get("food")).isCloseTo(0.5, within(1e-12));
        assertThat(deltas.get("author:" + id(7))).isEqualTo(1.0);
        assertThat(deltas.get("country:JP")).isCloseTo(0.3, within(1e-12));
    }

    @Test
    void impressionsAndMissingPartsAddNoAffinity() {
        assertThat(SignalUpdater.affinityDeltas(InteractionKind.IMPRESSION, 0, SparseVector.of(Map.of("a", 1.0)), id(1), "BR")).isEmpty();
        assertThat(SignalUpdater.affinityDeltas(InteractionKind.LIKE, 0, null, null, null)).isEmpty();
        assertThat(SignalUpdater.affinityDeltas(InteractionKind.HIDE_AUTHOR, 0, SparseVector.EMPTY, id(1), "")).containsOnlyKeys("author:" + id(1));
    }

    @ParameterizedTest
    @EnumSource(InteractionKind.class)
    void statsDeltasTouchTheRightCounter(InteractionKind kind) {
        StatsDelta delta = SignalUpdater.statsDelta(kind, 2_000);
        switch (kind) {
            case IMPRESSION -> assertThat(delta.impressions()).isEqualTo(1);
            case DWELL -> assertThat(delta.dwellMs()).isEqualTo(2_000);
            case LIKE -> assertThat(delta.likes()).isEqualTo(1);
            case UNLIKE -> assertThat(delta.likes()).isEqualTo(-1);
            case COMMENT -> assertThat(delta.comments()).isEqualTo(1);
            case SHARE -> assertThat(delta.shares()).isEqualTo(1);
            case HIDE_POST, REPORT -> assertThat(delta.hides()).isEqualTo(1);
            default -> assertThat(delta.isNone()).isTrue();
        }
        if (kind != InteractionKind.PROFILE_OPEN && kind != InteractionKind.FOLLOW && kind != InteractionKind.UNFOLLOW
                && kind != InteractionKind.MESSAGE_AUTHOR && kind != InteractionKind.HIDE_AUTHOR) {
            assertThat(delta.isNone()).isFalse();
        }
        assertThat(SignalUpdater.statsDelta(null, 0).isNone()).isTrue();
        assertThat(SignalUpdater.statsDelta(InteractionKind.DWELL, Long.MAX_VALUE).dwellMs()).isEqualTo(SignalUpdater.MAX_DWELL_MS);
    }

    @Test
    void scoresHalveEveryHalfLife() {
        assertThat(updater.decayed(8, NOW, NOW.plus(Duration.ofDays(14)))).isCloseTo(4, within(1e-9));
        assertThat(updater.decayed(8, NOW, NOW.plus(Duration.ofDays(28)))).isCloseTo(2, within(1e-9));
        assertThat(updater.decayed(8, NOW, NOW.minusSeconds(5))).isEqualTo(8);
        assertThat(updater.decayed(Double.NaN, NOW, NOW)).isZero();
        assertThat(updater.decayed(99, null, NOW)).isEqualTo(SignalUpdater.MAX);
    }

    @Test
    void applyDecaysThenAddsAndLateEventsAreDecayedInstead() {
        assertThat(updater.apply(8, NOW, 1, NOW.plus(Duration.ofDays(14)))).isCloseTo(5, within(1e-9));
        assertThat(updater.apply(8, NOW, 2, NOW.minus(Duration.ofDays(14)))).isCloseTo(9, within(1e-9));
        assertThat(updater.apply(0, null, 3, NOW)).isEqualTo(3);
        assertThat(updater.apply(Double.NaN, null, Double.NaN, null)).isZero();
        assertThat(updater.apply(1, NOW, 1, null)).isEqualTo(2);
        assertThat(updater.apply(19, NOW, 5, NOW)).isEqualTo(SignalUpdater.MAX);
        assertThat(updater.apply(-19, NOW, -5, NOW)).isEqualTo(-SignalUpdater.MAX);
    }

    @Test
    void storedAtIsTheLaterInstant() {
        assertThat(SignalUpdater.storedAt(NOW, NOW.plusSeconds(1))).isEqualTo(NOW.plusSeconds(1));
        assertThat(SignalUpdater.storedAt(NOW, NOW.minusSeconds(1))).isEqualTo(NOW);
        assertThat(SignalUpdater.storedAt(null, NOW)).isEqualTo(NOW);
        assertThat(SignalUpdater.storedAt(NOW, null)).isEqualTo(NOW);
    }

    @Test
    void invalidHalfLifeFallsBackToTwoWeeks() {
        assertThat(new SignalUpdater(Duration.ZERO).decayed(8, NOW, NOW.plus(Duration.ofDays(14)))).isCloseTo(4, within(1e-9));
        assertThat(new SignalUpdater(null).decayed(8, NOW, NOW.plus(Duration.ofDays(14)))).isCloseTo(4, within(1e-9));
        assertThat(new SignalUpdater(Duration.ofDays(-1)).decayed(8, NOW, NOW.plus(Duration.ofDays(14)))).isCloseTo(4, within(1e-9));
        assertThat(new SignalUpdater(Duration.ofDays(7)).decayed(8, NOW, NOW.plus(Duration.ofDays(14)))).isCloseTo(2, within(1e-9));
    }

    /** Exponential decay makes the result independent of arrival order: workers may process events in any order. */
    @Property(tries = 300)
    void arrivalOrderDoesNotMatter(@ForAll @Size(min = 1, max = 12) List<@DoubleRange(min = -1, max = 1) Double> deltas,
            @ForAll @Size(min = 12, max = 12) List<@LongRange(min = 0, max = 60 * 24 * 30) Long> minutes, @ForAll long seed) {
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < deltas.size(); i++) order.add(i);
        double inOrder = replay(deltas, minutes, order);
        Collections.shuffle(order, new Random(seed));
        assertThat(replay(deltas, minutes, order)).isCloseTo(inOrder, within(1e-9));
    }

    private double replay(List<Double> deltas, List<Long> minutes, List<Integer> order) {
        double score = 0;
        Instant updatedAt = null;
        for (int i : order) {
            Instant at = NOW.plus(Duration.ofMinutes(minutes.get(i)));
            score = updater.apply(score, updatedAt, deltas.get(i), at);
            updatedAt = SignalUpdater.storedAt(updatedAt, at);
        }
        return updater.decayed(score, updatedAt, NOW.plus(Duration.ofDays(31)));
    }

    @Property(tries = 300)
    void scoresStayWithinBounds(@ForAll double score, @ForAll double delta, @ForAll @LongRange(min = -100_000, max = 100_000) long minutes) {
        double result = updater.apply(score, NOW, delta, NOW.plus(Duration.ofMinutes(minutes)));
        assertThat(result).isFinite().isBetween(-SignalUpdater.MAX, SignalUpdater.MAX);
    }

    @Property(tries = 200)
    void decayNeverIncreasesMagnitude(@ForAll @DoubleRange(min = -20, max = 20) double score, @ForAll @LongRange(min = 0, max = 10_000_000) long seconds) {
        assertThat(Math.abs(updater.decayed(score, NOW, NOW.plusSeconds(seconds)))).isLessThanOrEqualTo(Math.abs(score));
    }
}
