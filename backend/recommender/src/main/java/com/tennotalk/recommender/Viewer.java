package com.tennotalk.recommender;

import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Who is asking, and everything learned about them. Affinities may be negative ("not interested").
 *
 * @param topics             topic and "tag:*" affinities
 * @param authors            affinity with each author
 * @param countries          affinity with authors' countries (ISO codes)
 * @param neighborEngagement per post: how much people with similar interests engaged with it
 * @param seen               posts already shown in earlier sessions
 * @param hiddenPosts        posts the viewer marked "not interested" (never shown)
 * @param hiddenAuthors      authors the viewer hid (never shown)
 */
public record Viewer(
        UUID id,
        String nativeLanguage,
        Set<String> learningLanguages,
        String receivingLanguage,
        String country,
        SparseVector topics,
        Map<UUID, Double> authors,
        SparseVector countries,
        Set<UUID> following,
        Set<UUID> secondDegree,
        Set<UUID> chatPartners,
        Map<UUID, Double> neighborEngagement,
        Set<UUID> seen,
        Set<UUID> hiddenPosts,
        Set<UUID> hiddenAuthors) {

    public Viewer {
        nativeLanguage = Safe.language(nativeLanguage);
        learningLanguages = Safe.languages(learningLanguages);
        receivingLanguage = Safe.language(receivingLanguage);
        country = Safe.text(country).toUpperCase(java.util.Locale.ROOT);
        topics = topics == null ? SparseVector.EMPTY : topics;
        authors = Safe.finiteMap(authors);
        countries = countries == null ? SparseVector.EMPTY : countries;
        following = Safe.set(following);
        secondDegree = Safe.set(secondDegree);
        chatPartners = Safe.set(chatPartners);
        neighborEngagement = Safe.finiteMap(neighborEngagement);
        seen = Safe.set(seen);
        hiddenPosts = Safe.set(hiddenPosts);
        hiddenAuthors = Safe.set(hiddenAuthors);
    }

    public double authorAffinity(UUID author) {
        Double value = author == null ? null : authors.get(author);
        return value == null ? 0 : value;
    }

    public double neighborEngagement(UUID post) {
        Double value = post == null ? null : neighborEngagement.get(post);
        return value == null ? 0 : value;
    }

    /** A viewer nobody knows anything about (cold start). */
    public static Viewer anonymous(UUID id) {
        return builder(id).build();
    }

    public static Builder builder(UUID id) {
        return new Builder(id);
    }

    public static final class Builder {
        private final UUID id;
        private String nativeLanguage = "";
        private Collection<String> learningLanguages = Set.of();
        private String receivingLanguage = "";
        private String country = "";
        private SparseVector topics = SparseVector.EMPTY;
        private Map<UUID, ? extends Number> authors = Map.of();
        private SparseVector countries = SparseVector.EMPTY;
        private Collection<UUID> following = Set.of();
        private Collection<UUID> secondDegree = Set.of();
        private Collection<UUID> chatPartners = Set.of();
        private Map<UUID, ? extends Number> neighborEngagement = Map.of();
        private Collection<UUID> seen = Set.of();
        private Collection<UUID> hiddenPosts = Set.of();
        private Collection<UUID> hiddenAuthors = Set.of();

        private Builder(UUID id) {
            this.id = id;
        }

        public Builder nativeLanguage(String value) { nativeLanguage = value; return this; }
        public Builder learningLanguages(Collection<String> value) { learningLanguages = value; return this; }
        public Builder receivingLanguage(String value) { receivingLanguage = value; return this; }
        public Builder country(String value) { country = value; return this; }
        public Builder topics(Map<String, ? extends Number> value) { topics = SparseVector.of(value); return this; }
        public Builder authors(Map<UUID, ? extends Number> value) { authors = value; return this; }
        public Builder countries(Map<String, ? extends Number> value) { countries = SparseVector.of(value); return this; }
        public Builder following(Collection<UUID> value) { following = value; return this; }
        public Builder secondDegree(Collection<UUID> value) { secondDegree = value; return this; }
        public Builder chatPartners(Collection<UUID> value) { chatPartners = value; return this; }
        public Builder neighborEngagement(Map<UUID, ? extends Number> value) { neighborEngagement = value; return this; }
        public Builder seen(Collection<UUID> value) { seen = value; return this; }
        public Builder hiddenPosts(Collection<UUID> value) { hiddenPosts = value; return this; }
        public Builder hiddenAuthors(Collection<UUID> value) { hiddenAuthors = value; return this; }

        public Viewer build() {
            return new Viewer(id, nativeLanguage, Safe.languages(learningLanguages), receivingLanguage, country, topics,
                    Safe.finiteMap(authors), countries, Safe.set(following), Safe.set(secondDegree), Safe.set(chatPartners),
                    Safe.finiteMap(neighborEngagement), Safe.set(seen), Safe.set(hiddenPosts), Safe.set(hiddenAuthors));
        }
    }
}
