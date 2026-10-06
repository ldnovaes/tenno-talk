package com.tennotalk.discovery;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;

import com.tennotalk.common.ApiException;

import static org.assertj.core.api.Assertions.assertThat;

/** Pure pieces of Discover (PLAN.md §37.6) under arbitrary input. */
class DiscoveryPropertiesTest {

    // ---- DiscoverCursor ----

    @Property
    void aCursorSurvivesTheRoundTrip(@ForAll("uuids") UUID session, @ForAll @IntRange(min = 0, max = Integer.MAX_VALUE) int offset) {
        DiscoverCursor cursor = new DiscoverCursor(session, offset);
        assertThat(DiscoverCursor.decodeOrNull(cursor.encode())).isEqualTo(cursor);
        assertThat(cursor.encode()).as("URL-safe, no padding").matches("[A-Za-z0-9_-]+");
    }

    @Property
    void aNegativeOffsetStartsFromTheTop(@ForAll("uuids") UUID session, @ForAll @IntRange(min = Integer.MIN_VALUE, max = -1) int offset) {
        assertThat(new DiscoverCursor(session, offset).offset()).isZero();
    }

    @Property(tries = 2000)
    void anyTextIsACursorOrAValidationError(@ForAll String text) {
        try {
            DiscoverCursor.decodeOrNull(text);
        } catch (ApiException invalid) {
            assertThat(invalid.code().wireName()).isEqualTo("validation");
        }
    }

    @Provide
    Arbitrary<UUID> uuids() {
        return Arbitraries.create(UUID::randomUUID);
    }

    // ---- CandidateRetriever.interleave ----

    /** A pool of a few ids, so sources overlap like real candidate sources do. */
    @Provide
    Arbitrary<List<List<UUID>>> sources() {
        List<UUID> pool = new ArrayList<>();
        for (int n = 0; n < 12; n++) pool.add(new UUID(0, n));
        Arbitrary<List<UUID>> source = Arbitraries.of(pool).list().ofMaxSize(10);
        return source.list().ofMaxSize(5);
    }

    @Provide
    Arbitrary<Set<UUID>> excluded() {
        return Arbitraries.integers().between(0, 11).map(n -> new UUID(0, n)).set().ofMaxSize(4);
    }

    @Property(tries = 2000)
    void interleavingIsBoundedFreshAndFromTheSources(@ForAll("sources") List<List<UUID>> sources, @ForAll("excluded") Set<UUID> exclude,
            @ForAll @IntRange(min = 0, max = 30) int limit) {
        List<UUID> result = CandidateRetriever.interleave(sources, exclude, limit);

        assertThat(result.size()).isLessThanOrEqualTo(limit);
        assertThat(result).doesNotHaveDuplicates();
        if (!exclude.isEmpty()) assertThat(result).doesNotContainAnyElementsOf(exclude);
        Set<UUID> offered = new HashSet<>();
        sources.forEach(offered::addAll);
        assertThat(offered).containsAll(result);

        // Nothing is dropped while there is room: every offered, allowed id is in, up to the limit.
        Set<UUID> eligible = new HashSet<>(offered);
        eligible.removeAll(exclude);
        assertThat(result.size()).isEqualTo(Math.min(limit, eligible.size()));
    }

    @net.jqwik.api.Example
    void sourcesTakeTurnsAndAnIdSeenEarlierIsNotRepeated() {
        UUID a1 = new UUID(1, 1), a2 = new UUID(1, 2), b1 = new UUID(2, 1), b2 = new UUID(2, 2), c1 = new UUID(3, 1);
        List<List<UUID>> sources = List.of(List.of(a1, a2), List.of(b1, a1, b2), List.of(c1));
        assertThat(CandidateRetriever.interleave(sources, Set.of(), 10)).containsExactly(a1, b1, c1, a2, b2);
        assertThat(CandidateRetriever.interleave(sources, Set.of(b1), 3)).containsExactly(a1, c1, a2);
    }
}
