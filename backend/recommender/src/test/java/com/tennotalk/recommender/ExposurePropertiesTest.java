package com.tennotalk.recommender;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;

class ExposurePropertiesTest {

    @Provide
    Arbitrary<List<Candidate>> pools() {
        Arbitrary<Candidate> post = Combinators.combine(Arbitraries.integers().between(1, 5_000),
                        Arbitraries.integers().between(1, 8), Arbitraries.integers().between(0, 100),
                        Arbitraries.longs().between(0, 120))
                .as((id, author, ageHours, impressions) -> Fixtures.post(id, author, Duration.ofHours(ageHours), impressions));
        return post.list().ofMaxSize(60).uniqueElements(Candidate::postId);
    }

    @Property(tries = 800)
    void reservedSlotsGoToUnderExposedPostsWhileThereAreAny(@ForAll("pools") List<Candidate> pool,
            @ForAll @IntRange(min = 1, max = 4) int slots, @ForAll @IntRange(min = 5, max = 12) int block) {
        RecommenderConfig config = Fixtures.withExposure(Fixtures.roomy(), slots, block, 50);
        Recommender core = Recommender.builder().config(config).build();
        ExposureFloor floor = new ExposureFloor(config);

        List<Ranked> items = core.rank(Fixtures.request(Fixtures.viewer(), pool, pool.size())).items();

        long needy = pool.stream().filter(c -> floor.underExposed(c, Fixtures.NOW)).count();
        long placedInReserved = items.stream().filter(Ranked::exposure).count();
        long reservedPositions = reservedPositions(block, slots, items.size());
        // Every reserved slot is used while needy posts remain (some may already rank above their slot).
        assertThat(placedInReserved).isLessThanOrEqualTo(Math.min(needy, reservedPositions));
        Set<UUID> needyIds = new HashSet<>();
        pool.stream().filter(c -> floor.underExposed(c, Fixtures.NOW)).forEach(c -> needyIds.add(c.postId()));
        int firstReservedLeftToOthers = -1;
        for (int i = 0; i < items.size(); i++) {
            if (isReserved(i, block, slots) && !items.get(i).exposure()) {
                firstReservedLeftToOthers = i;
                break;
            }
        }
        if (firstReservedLeftToOthers >= 0) {
            // A reserved slot went to a regular post only because every needy post was already placed above it.
            Set<UUID> above = new HashSet<>();
            for (int i = 0; i < firstReservedLeftToOthers; i++) above.add(items.get(i).postId());
            assertThat(above).containsAll(needyIds);
        }
    }

    @Property(tries = 800)
    void theFloorOnlyMovesPostsNeverDropsThem(@ForAll("pools") List<Candidate> pool) {
        List<Ranked> items = Fixtures.core().rank(Fixtures.request(Fixtures.viewer(), pool, pool.size())).items();
        assertThat(items).extracting(Ranked::postId).containsExactlyInAnyOrderElementsOf(pool.stream().map(Candidate::postId).toList());
    }

    private static boolean isReserved(int position, int block, int slots) {
        int offset = position % block;
        for (int j = 1; j <= slots; j++) if (j * block / (slots + 1) == offset) return true;
        return false;
    }

    private static long reservedPositions(int block, int slots, int size) {
        long count = 0;
        for (int i = 0; i < size; i++) if (isReserved(i, block, slots)) count++;
        return count;
    }
}
