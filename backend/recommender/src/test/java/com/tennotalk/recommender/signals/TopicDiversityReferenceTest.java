package com.tennotalk.recommender.signals;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

import com.tennotalk.recommender.Contexts;
import com.tennotalk.recommender.Fixtures;
import com.tennotalk.recommender.Ranked;
import com.tennotalk.recommender.Reranker;

import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;

/** The optimized TopicDiversity (encoded vectors) must order exactly like the plain MMR on SparseVector.cosine. */
class TopicDiversityReferenceTest {

    @Provide
    Arbitrary<List<Ranked>> lists() {
        Arbitrary<Map<String, Double>> topics = Arbitraries.maps(Arbitraries.of("travel", "food", "music", "tag:a", "tag:b", "tag:c", "art"),
                Arbitraries.doubles().between(-3, 3).filter(d -> d != 0)).ofMaxSize(5);
        Arbitrary<Ranked> ranked = Combinators.combine(Arbitraries.integers().between(1, 100_000), topics, Arbitraries.doubles().between(0, 5))
                .as((id, t, score) -> new Ranked(Fixtures.postBuilder(id, id).topics(t).build(), score, false, null));
        return ranked.list().ofMaxSize(40).uniqueElements(Ranked::postId);
    }

    @Property(tries = 1000)
    void matchesTheReference(@ForAll("lists") List<Ranked> list, @ForAll("penalties") double penalty) {
        TopicDiversity diversity = new TopicDiversity(Reranker.IDENTITY, penalty);
        List<Ranked> actual = diversity.rerank(Contexts.of(Fixtures.viewer(), List.of(diversity.name())), list);
        assertThat(actual).isEqualTo(reference(list, penalty));
    }

    @Provide
    Arbitrary<Double> penalties() {
        return Arbitraries.of(0.1, 0.5, 1.0, 3.0);
    }

    private static List<Ranked> reference(List<Ranked> ranked, double penalty) {
        LinkedList<Ranked> pending = new LinkedList<>(ranked);
        List<Ranked> result = new ArrayList<>();
        while (!pending.isEmpty()) {
            int best = 0;
            double bestValue = Double.NEGATIVE_INFINITY;
            for (int i = 0; i < Math.min(TopicDiversity.WINDOW, pending.size()); i++) {
                double max = 0;
                for (int j = Math.max(0, result.size() - TopicDiversity.MEMORY); j < result.size(); j++) {
                    max = Math.max(max, pending.get(i).candidate().topics().cosine(result.get(j).candidate().topics()));
                }
                double value = pending.get(i).score() - penalty * max;
                if (value > bestValue + TopicDiversity.TIE) {
                    bestValue = value;
                    best = i;
                }
            }
            result.add(pending.remove(best));
        }
        return result;
    }
}
