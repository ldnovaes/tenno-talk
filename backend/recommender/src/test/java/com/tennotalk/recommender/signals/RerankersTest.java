package com.tennotalk.recommender.signals;

import static com.tennotalk.recommender.Fixtures.id;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.Contexts;
import com.tennotalk.recommender.Fixtures;
import com.tennotalk.recommender.Ranked;
import com.tennotalk.recommender.RerankDecorator;
import com.tennotalk.recommender.Reranker;

class RerankersTest {

    private static Ranked ranked(int post, int author, double score, String topic) {
        Candidate.Builder builder = Fixtures.postBuilder(post, author);
        if (topic != null) builder.topics(Map.of(topic, 1.0));
        return new Ranked(builder.build(), score, false, null);
    }

    private static List<UUID> authors(List<Ranked> list) {
        return list.stream().map(Ranked::authorId).toList();
    }

    private static List<Ranked> run(RerankDecorator decorator, List<Ranked> list) {
        var context = Contexts.of(Fixtures.viewer(), List.of(decorator.name()));
        List<Ranked> result = decorator.rerank(context, list);
        assertThat(Contexts.failures(context)).isEmpty();
        return result;
    }

    @Test
    void authorSpacingKeepsAnAuthorOutOfTheNextPositions() {
        List<Ranked> list = List.of(ranked(1, 1, 9, null), ranked(2, 1, 8, null), ranked(3, 1, 7, null), ranked(4, 2, 6, null),
                ranked(5, 3, 5, null), ranked(6, 4, 4, null), ranked(7, 5, 3, null));

        List<Ranked> result = run(new AuthorSpacing(Reranker.IDENTITY, 4), list);

        assertThat(authors(result)).containsExactly(id(1), id(2), id(3), id(4), id(1), id(5), id(1));
    }

    @Test
    void authorSpacingRelaxesWhenOnlyOneAuthorIsLeft() {
        List<Ranked> list = List.of(ranked(1, 1, 9, null), ranked(2, 1, 8, null), ranked(3, 1, 7, null));
        assertThat(run(new AuthorSpacing(Reranker.IDENTITY, 4), list)).isEqualTo(list);
    }

    @Test
    void authorSpacingOfOneIsTheIdentity() {
        List<Ranked> list = List.of(ranked(1, 1, 9, null), ranked(2, 1, 8, null), ranked(3, 2, 7, null));
        assertThat(run(new AuthorSpacing(Reranker.IDENTITY, 1), list)).isEqualTo(list);
        assertThat(run(new AuthorSpacing(Reranker.IDENTITY, -3), list)).isEqualTo(list);
    }

    @Test
    void topicDiversityBreaksARunOfOneTopic() {
        List<Ranked> list = List.of(ranked(1, 1, 3.0, "travel"), ranked(2, 2, 2.9, "travel"), ranked(3, 3, 2.8, "food"),
                ranked(4, 4, 2.7, "travel"));

        List<Ranked> result = run(new TopicDiversity(Reranker.IDENTITY, 0.5), list);

        assertThat(result).extracting(Ranked::postId).containsExactly(id(1), id(3), id(2), id(4));
    }

    @Test
    void topicDiversityNeverOverridesAClearlyBetterPost() {
        List<Ranked> list = List.of(ranked(1, 1, 9, "travel"), ranked(2, 2, 8, "travel"), ranked(3, 3, 1, "food"));
        assertThat(run(new TopicDiversity(Reranker.IDENTITY, 0.5), list)).isEqualTo(list);
    }

    @Test
    void topicDiversityOnlyLooksAShortWindowAhead() {
        List<Ranked> list = new ArrayList<>();
        for (int i = 0; i < 6; i++) list.add(ranked(i + 1, i + 1, 5 - i * 0.01, "travel"));
        list.add(ranked(99, 99, 4.9, "food")); // 7th: outside the window of the first pick

        assertThat(run(new TopicDiversity(Reranker.IDENTITY, 0.5), list).getFirst().postId()).isEqualTo(id(1));
        assertThat(run(new TopicDiversity(Reranker.IDENTITY, 0.5), list).indexOf(list.get(6))).isLessThan(6);
    }

    @Test
    void zeroOrInvalidPenaltyIsTheIdentity() {
        List<Ranked> list = List.of(ranked(1, 1, 3.0, "travel"), ranked(2, 2, 2.9, "travel"), ranked(3, 3, 2.8, "food"));
        assertThat(run(new TopicDiversity(Reranker.IDENTITY, 0), list)).isEqualTo(list);
        assertThat(run(new TopicDiversity(Reranker.IDENTITY, Double.NaN), list)).isEqualTo(list);
    }
}
