package com.tennotalk.recommender;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SplittableRandom;
import java.util.UUID;

/** Synthetic retrieval only: this does not benchmark SQL or claim catalog-wide exposure. */
final class SocialPopulation {
    static final List<String> TOPICS = List.of("travel", "food", "music", "sports", "books", "gaming");
    private static final List<String> LANGUAGES = List.of("pt-BR", "ja", "ar", "en", "vi", "es");
    private static final List<String> COUNTRIES = List.of("BR", "JP", "EG", "US", "VN", "ES");
    private final List<Candidate> catalog;
    private final long seed;

    SocialPopulation(int size, long seed) {
        this.seed = seed;
        SplittableRandom random = new SplittableRandom(seed);
        List<Candidate> posts = new ArrayList<>(size);
        for (int i = 0; i < size; i++) {
            int group = i % TOPICS.size();
            // A few prolific authors, a long tail, old viral posts and recent unknown posts.
            int author = random.nextDouble() < 0.3 ? random.nextInt(20) : random.nextInt(10_000);
            long impressions = i % 4 == 0 ? random.nextLong(50) : random.nextLong(50, 100_000);
            long age = i % 4 == 0 ? random.nextLong(72 * 60) : random.nextLong(14 * 24 * 60);
            posts.add(Candidate.builder(Fixtures.id(i + 1), Fixtures.id(200_000 + author))
                    .createdAt(Fixtures.NOW.minus(Duration.ofMinutes(age)))
                    .language(LANGUAGES.get(group)).authorNativeLanguage(LANGUAGES.get(group))
                    .authorLearningLanguages(List.of(LANGUAGES.get((group + 1) % TOPICS.size())))
                    .authorCountry(COUNTRIES.get(group))
                    .topics(Map.of(TOPICS.get(group), 1.0, "tag:topic" + random.nextInt(100), 0.3))
                    .stats(new PostStats(impressions, impressions / 12, impressions / 80, impressions / 100,
                            i % 19 == 0 ? impressions / 3 : 0, impressions * 3_000)).build());
        }
        catalog = List.copyOf(posts);
    }

    RankRequest request(int session) {
        SplittableRandom random = new SplittableRandom(seed ^ ((long) session * 0x9E3779B97F4A7C15L));
        List<Candidate> candidates = new ArrayList<>();
        Set<Integer> picked = new HashSet<>();
        while (picked.size() < 496) {
            int index = random.nextInt(catalog.size());
            if (picked.add(index)) candidates.add(catalog.get(index));
        }
        int person = session % 2_000;
        UUID viewerId = Fixtures.id(400_000 + person);
        int group = person % TOPICS.size();
        Viewer.Builder viewer = Viewer.builder(viewerId)
                .hiddenPosts(List.of(candidates.get(0).postId()))
                .hiddenAuthors(List.of(candidates.get(1).authorId()));
        if (person % 5 != 0) { // 20% cold starts.
            viewer.nativeLanguage(LANGUAGES.get(group)).learningLanguages(List.of(LANGUAGES.get((group + 1) % 6)))
                    .receivingLanguage(LANGUAGES.get(group)).country(COUNTRIES.get(group))
                    .topics(Map.of(TOPICS.get(group), 5.0, TOPICS.get((group + 3) % 6), -3.0))
                    .authors(Map.of(candidates.get(2).authorId(), 4.0))
                    .countries(Map.of(COUNTRIES.get((group + 1) % 6), 2.0))
                    .following(List.of(candidates.get(3).authorId()))
                    .secondDegree(List.of(candidates.get(4).authorId()))
                    .chatPartners(List.of(candidates.get(5).authorId()))
                    .neighborEngagement(Map.of(candidates.get(6).postId(), 3.0))
                    .seen(candidates.subList(7, 40).stream().map(Candidate::postId).toList());
        }
        candidates.add(Candidate.builder(Fixtures.id(900_000), viewerId).createdAt(Fixtures.NOW).build());
        candidates.add(candidates.get(2)); // Overlapping retrieval sources.
        candidates.add(null);
        candidates.add(Candidate.builder(null, viewerId).build());
        return new RankRequest(viewer.build(), candidates, 300, random.nextLong(), Fixtures.NOW);
    }
}
