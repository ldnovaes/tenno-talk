package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.tennotalk.recommender.Saboteurs.Constant;
import com.tennotalk.recommender.Saboteurs.FakeTicker;
import com.tennotalk.recommender.Saboteurs.Rogue;
import com.tennotalk.recommender.Saboteurs.Throwing;

/** The final methods of the decorator bases: chaining, guarding and accounting. */
class DecoratorBaseTest {

    private final Candidate post = Fixtures.post(1, 2);

    private static RankContext context(List<String> signals, FakeTicker ticker) {
        return new RankContext(Fixtures.viewer(), Fixtures.NOW, 1, 10, ticker, signals, java.util.Set.of());
    }

    @Test
    void decoratorsChainAndSeeTheScoreBelowThem() {
        Scorer chain = new Constant(new Constant((c, p) -> 1, "a", 2), "b", 3);
        assertThat(chain.score(context(List.of("a", "b"), new FakeTicker()), post)).isEqualTo(6);
    }

    @Test
    void aFailingDecoratorReturnsTheScoreBelowIt() {
        RankContext context = context(List.of("ok", "bad", "nan"), new FakeTicker());
        Scorer throwing = new Throwing(new Constant((c, p) -> 1, "ok", 2), "bad", c -> true, IllegalStateException::new);
        assertThat(throwing.score(context, post)).isEqualTo(3);
        assertThat(new Constant(throwing, "nan", Double.NaN).score(context, post)).isEqualTo(3);
        assertThat(Contexts.failures(context)).containsOnlyKeys("bad", "nan");
    }

    @Test
    void timeIsAccountedPerSignal() {
        FakeTicker ticker = new FakeTicker();
        RankContext context = context(List.of("slow", "rogue"), ticker);
        new Saboteurs.Slow(Scorer.ZERO, "slow", ticker, 7).score(context, post);
        new Throwing(Scorer.ZERO, "slow", c -> {
            ticker.advance(5);
            return true;
        }, IllegalStateException::new).score(context, post);
        new Rogue(Reranker.IDENTITY, "rogue", list -> {
            ticker.advance(11);
            return list;
        }).rerank(context, List.of());
        new Rogue(Reranker.IDENTITY, "rogue", list -> {
            ticker.advance(13);
            throw new IllegalStateException();
        }).rerank(context, List.of());

        assertThat(context.nanos("slow")).isEqualTo(12);
        assertThat(context.nanos("rogue")).isEqualTo(24);
    }

    @Test
    void rerankersRunInsideOut() {
        Ranked a = new Ranked(Fixtures.post(1, 1), 2, false, null);
        Ranked b = new Ranked(Fixtures.post(2, 2), 1, false, null);
        Reranker reverse = new Rogue(Reranker.IDENTITY, "reverse", list -> List.of(list.get(1), list.get(0)));
        Reranker dropFirstIfA = new Rogue(reverse, "check", list -> {
            assertThat(list.getFirst()).isEqualTo(b); // sees the inner result
            return list;
        });
        RankContext context = context(List.of("reverse", "check"), new FakeTicker());
        assertThat(dropFirstIfA.rerank(context, List.of(a, b))).containsExactly(b, a);
        assertThat(Contexts.failures(context)).isEmpty();
    }
}
