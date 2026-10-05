package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import net.jqwik.api.Example;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;

/** Contract every {@link RerankDecorator} must pass. Extend it as {@code <Decorator>ContractTest}. */
public abstract class RerankDecoratorContract {

    protected abstract RerankDecorator create(Reranker inner);

    private RerankDecorator decorator() {
        return create(Reranker.IDENTITY);
    }

    @Provide
    Arbitrary<List<Ranked>> lists() {
        Arbitrary<Ranked> ranked = Combinators.combine(
                        Generators.candidates().filter(c -> c != null && c.hasIds()),
                        Arbitraries.doubles().between(-20, 20))
                .as((candidate, score) -> new Ranked(candidate, score, false, null));
        return ranked.list().ofMaxSize(60).uniqueElements(Ranked::postId).map(list -> {
            List<Ranked> sorted = new ArrayList<>(list);
            sorted.sort(Ordering.BY_SCORE);
            return sorted;
        });
    }

    @Property(tries = 400)
    void returnsAPermutationAndNeverFails(@ForAll("lists") List<Ranked> ranked) {
        RerankDecorator decorator = decorator();
        RankContext context = Contexts.of(Fixtures.viewer(), List.of(decorator.name()));

        List<Ranked> result = decorator.rerank(context, ranked);

        assertThat(result).containsExactlyInAnyOrderElementsOf(ranked);
        assertThat(Contexts.failures(context)).isEmpty();
    }

    @Property(tries = 200)
    void isDeterministic(@ForAll("lists") List<Ranked> ranked) {
        RerankDecorator decorator = decorator();
        List<Ranked> first = decorator.rerank(Contexts.of(Fixtures.viewer(), List.of(decorator.name())), ranked);
        assertThat(decorator().rerank(Contexts.of(Fixtures.viewer(), List.of(decorator.name())), ranked)).isEqualTo(first);
    }

    @Property(tries = 100)
    void whenSwitchedOffKeepsTheOrder(@ForAll("lists") List<Ranked> ranked) {
        RerankDecorator decorator = decorator();
        assertThat(decorator.rerank(Contexts.disabled(Fixtures.viewer(), List.of(decorator.name())), ranked)).isEqualTo(ranked);
    }

    @Example
    void emptyAndSingletonListsAreUnchanged() {
        RerankDecorator decorator = decorator();
        RankContext context = Contexts.of(Fixtures.viewer(), List.of(decorator.name()));
        assertThat(decorator.rerank(context, List.of())).isEmpty();
        Ranked only = new Ranked(Fixtures.post(1, 2), 1, false, null);
        assertThat(decorator.rerank(context, List.of(only))).containsExactly(only);
    }

    @Example
    void hasAStableKebabCaseName() {
        assertThat(decorator().name()).matches("[a-z]+(-[a-z]+)*").isNotEqualTo("freshness");
        assertThat(Objects.equals(decorator().name(), decorator().name())).isTrue();
    }
}
