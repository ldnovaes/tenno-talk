package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Objects;

import net.jqwik.api.Arbitrary;
import net.jqwik.api.Example;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;

/**
 * Contract every {@link ScoreDecorator} must pass (PLAN.md §37.8). Extend it as {@code <Decorator>ContractTest};
 * {@link EveryDecoratorHasAContractTest} fails the build when a decorator has none.
 * "Never fails" here means on any valid model value: the envelope would contain a failure, but a signal
 * that fails on real data is a bug.
 */
public abstract class ScoreDecoratorContract {

    private static final double INNER = 0.25;

    protected abstract ScoreDecorator create(Scorer inner);

    private ScoreDecorator decorator() {
        return create((context, candidate) -> INNER);
    }

    @Provide
    Arbitrary<Viewer> viewers() {
        return Generators.viewers().filter(Objects::nonNull);
    }

    @Provide
    Arbitrary<Candidate> candidates() {
        return Generators.candidates().filter(c -> c != null && c.hasIds());
    }

    @Property(tries = 400)
    void addsAFiniteBoundedContributionAndNeverFails(@ForAll("viewers") Viewer viewer, @ForAll("candidates") Candidate candidate) {
        ScoreDecorator decorator = decorator();
        RankContext context = Contexts.of(viewer, List.of(decorator.name()));

        double score = decorator.score(context, candidate);

        assertThat(score).isFinite();
        assertThat(Math.abs(score - INNER)).isLessThanOrEqualTo(Contexts.cap());
        assertThat(Contexts.failures(context)).isEmpty();
    }

    @Property(tries = 200)
    void isDeterministicAndStateless(@ForAll("viewers") Viewer viewer, @ForAll("candidates") Candidate a, @ForAll("candidates") Candidate b) {
        ScoreDecorator decorator = decorator();
        RankContext context = Contexts.of(viewer, List.of(decorator.name()));
        double first = decorator.score(context, a);
        decorator.score(context, b);
        assertThat(decorator.score(context, a)).isEqualTo(first);
        assertThat(decorator().score(Contexts.of(viewer, List.of(decorator.name())), a)).isEqualTo(first);
    }

    @Property(tries = 100)
    void whenSwitchedOffPassesTheInnerScoreThrough(@ForAll("viewers") Viewer viewer, @ForAll("candidates") Candidate candidate) {
        ScoreDecorator decorator = decorator();
        assertThat(decorator.score(Contexts.disabled(viewer, List.of(decorator.name())), candidate)).isEqualTo(INNER);
    }

    @Example
    void hasAStableKebabCaseName() {
        String name = decorator().name();
        assertThat(name).matches("[a-z]+(-[a-z]+)*").isNotEqualTo("freshness").isEqualTo(decorator().name());
    }

    @Example
    void toleratesTheAnonymousViewerAndAnEmptyPost() {
        ScoreDecorator decorator = decorator();
        RankContext context = Contexts.of(Viewer.anonymous(null), List.of(decorator.name()));
        assertThat(decorator.score(context, Candidate.builder(Fixtures.id(1), Fixtures.id(2)).build())).isFinite();
        assertThat(Contexts.failures(context)).isEmpty();
    }
}
