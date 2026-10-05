package com.tennotalk.recommender;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;

/**
 * Hostile inputs: nulls, NaN, ±∞, extreme instants, repeated ids, regional language variants, huge counters.
 * The core must stay valid for every value these produce.
 */
public final class Generators {

    private static final List<String> LANGUAGES = java.util.Arrays.asList("pt", "pt-BR", "PT_br", "en", "en-US", "ja", "vi", "ar", "", " ", null);
    private static final List<String> COUNTRIES = java.util.Arrays.asList("BR", "br", "VN", "JP", "US", "", null);
    private static final List<String> TOPIC_KEYS = List.of("travel", "food", "music", "language-learning", "tag:cafe", "tag:東京", "sports");

    private Generators() {}

    /** A small pool, so posts, authors and the viewer collide often. */
    public static Arbitrary<UUID> ids() {
        return Arbitraries.integers().between(0, 40).map(Fixtures::id).injectNull(0.03);
    }

    public static Arbitrary<Double> nastyDoubles() {
        return Arbitraries.oneOf(
                Arbitraries.doubles().between(-50, 50),
                Arbitraries.of(Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.MAX_VALUE,
                        -Double.MAX_VALUE, Double.MIN_VALUE, 0.0, -0.0));
    }

    public static Arbitrary<Instant> instants() {
        return Arbitraries.oneOf(
                Arbitraries.longs().between(-3_600_000L * 24 * 400, 3_600_000L * 24 * 30)
                        .map(offset -> Fixtures.NOW.plusMillis(offset)),
                Arbitraries.of(Instant.MIN, Instant.MAX, Instant.EPOCH, Fixtures.NOW))
                .injectNull(0.03);
    }

    public static Arbitrary<String> languages() {
        return Arbitraries.of(LANGUAGES);
    }

    public static Arbitrary<SparseVector> vectors() {
        return Arbitraries.maps(Arbitraries.of(TOPIC_KEYS), nastyDoubles()).ofMaxSize(5).map(SparseVector::of);
    }

    public static Arbitrary<PostStats> stats() {
        Arbitrary<Long> counts = Arbitraries.oneOf(Arbitraries.longs().between(-5, 2_000), Arbitraries.of(Long.MAX_VALUE, Long.MIN_VALUE));
        return Combinators.combine(counts, counts, counts, counts, counts, counts).as(PostStats::new);
    }

    public static Arbitrary<Candidate> candidates() {
        Arbitrary<Candidate.Builder> identity = Combinators.combine(ids(), ids(), instants())
                .as((post, author, at) -> Candidate.builder(post, author).createdAt(at));
        return Combinators.combine(identity, languages(), languages(), languages().list().ofMaxSize(3), Arbitraries.of(COUNTRIES),
                        vectors(), stats())
                .as((builder, language, nativeLanguage, learning, country, topics, stats) -> builder.language(language)
                        .authorNativeLanguage(nativeLanguage).authorLearningLanguages(learning).authorCountry(country)
                        .topics(topics).stats(stats).build())
                .injectNull(0.03);
    }

    public static Arbitrary<Viewer> viewers() {
        Arbitrary<Viewer.Builder> profile = Combinators.combine(ids(), languages(), languages().list().ofMaxSize(3), languages(),
                        Arbitraries.of(COUNTRIES))
                .as((id, nativeLanguage, learning, receiving, country) -> Viewer.builder(id).nativeLanguage(nativeLanguage)
                        .learningLanguages(learning).receivingLanguage(receiving).country(country));
        Arbitrary<Map<UUID, Double>> affinities = Arbitraries.maps(ids(), nastyDoubles()).ofMaxSize(6);
        Arbitrary<List<UUID>> idSet = ids().list().ofMaxSize(6);
        return Combinators.combine(profile, vectors(), affinities, vectors(), idSet, idSet, idSet, affinities)
                .as((builder, topics, authors, countries, following, chat, hidden, neighbors) -> builder
                        .topics(topics.weights()).authors(authors).countries(countries.weights()).following(following)
                        .chatPartners(chat).secondDegree(chat).hiddenAuthors(hidden.subList(0, Math.min(1, hidden.size())))
                        .hiddenPosts(hidden).seen(following).neighborEngagement(neighbors).build());
    }

    public static Arbitrary<RankRequest> requests() {
        return Combinators.combine(viewers().injectNull(0.02), candidates().list().ofMaxSize(80).injectNull(0.02),
                        Arbitraries.integers().between(-3, 100), Arbitraries.longs(), instants())
                .as(RankRequest::new);
    }
}
