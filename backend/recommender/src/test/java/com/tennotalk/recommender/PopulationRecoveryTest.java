package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.tennotalk.recommender.signals.RankingWeights;
import com.tennotalk.recommender.signals.StandardRecommender;

class PopulationRecoveryTest {
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void brokenSignalIsIsolatedThenRecoversWithoutRebuildingTheRecommender(boolean invalidNumber) {
        SocialPopulation population = new SocialPopulation(5_000, 42);
        AtomicBoolean broken = new AtomicBoolean(true);
        Recommender recommender = StandardRecommender.builder(RankingWeights.defaults(), Fixtures.roomy())
                .score(inner -> new ScoreDecorator(inner, "outage") {
                    @Override
                    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
                        if (!broken.get()) return 0.25;
                        if (invalidNumber) return Double.NaN;
                        throw new IllegalStateException("simulated outage");
                    }
                }).build();
        for (int i = 0; i < 40; i++) {
            RankRequest request = population.request(i);
            Ranking result = recommender.rank(request);
            RankingAssertions.valid(request, result, recommender.config());
            if (i < recommender.config().breakerThreshold()) {
                assertThat(result.diagnostics().failures()).containsKey("outage");
            } else {
                assertThat(result.diagnostics().disabled()).containsExactly("outage");
            }
            // A failed signal must not affect the contribution/order of the healthy signals.
            assertThat(result.items()).isEqualTo(Fixtures.standard().rank(request).items());
        }
        broken.set(false);
        for (int i = 40; i < 80; i++) {
            RankRequest original = population.request(i);
            RankRequest recovered = new RankRequest(original.viewer(), original.candidates(), original.limit(), original.seed(),
                    Fixtures.NOW.plus(recommender.config().breakerCooldown()).plusSeconds(1), true);
            Ranking result = recommender.rank(recovered);
            RankingAssertions.valid(recovered, result, recommender.config());
            RankingAssertions.healthy(result);
            assertThat(result.items()).allSatisfy(item -> assertThat(item.contributions()).containsEntry("outage", .25));
        }
    }
}
