package com.tennotalk.recommender;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * A post that may be shown. Fields describe the post and its author; everything is normalized
 * (languages to base codes, nulls to empty values). A candidate without ids is dropped by Sanitize.
 */
public record Candidate(
        UUID postId,
        UUID authorId,
        Instant createdAt,
        String language,
        String authorNativeLanguage,
        Set<String> authorLearningLanguages,
        String authorCountry,
        SparseVector topics,
        PostStats stats) {

    public Candidate {
        createdAt = Safe.instant(createdAt, Instant.EPOCH);
        language = Safe.language(language);
        authorNativeLanguage = Safe.language(authorNativeLanguage);
        authorLearningLanguages = Safe.languages(authorLearningLanguages);
        authorCountry = Safe.text(authorCountry).toUpperCase(java.util.Locale.ROOT);
        topics = topics == null ? SparseVector.EMPTY : topics;
        stats = stats == null ? PostStats.EMPTY : stats;
    }

    boolean hasIds() {
        return postId != null && authorId != null;
    }

    public static Builder builder(UUID postId, UUID authorId) {
        return new Builder(postId, authorId);
    }

    public static final class Builder {
        private final UUID postId;
        private final UUID authorId;
        private Instant createdAt = Instant.EPOCH;
        private String language = "";
        private String authorNativeLanguage = "";
        private Collection<String> authorLearningLanguages = Set.of();
        private String authorCountry = "";
        private SparseVector topics = SparseVector.EMPTY;
        private PostStats stats = PostStats.EMPTY;

        private Builder(UUID postId, UUID authorId) {
            this.postId = postId;
            this.authorId = authorId;
        }

        public Builder createdAt(Instant value) { createdAt = value; return this; }
        public Builder language(String value) { language = value; return this; }
        public Builder authorNativeLanguage(String value) { authorNativeLanguage = value; return this; }
        public Builder authorLearningLanguages(Collection<String> value) { authorLearningLanguages = value; return this; }
        public Builder authorCountry(String value) { authorCountry = value; return this; }
        public Builder topics(Map<String, ? extends Number> value) { topics = SparseVector.of(value); return this; }
        public Builder topics(SparseVector value) { topics = value; return this; }
        public Builder stats(PostStats value) { stats = value; return this; }

        public Candidate build() {
            return new Candidate(postId, authorId, createdAt, language, authorNativeLanguage,
                    Safe.languages(authorLearningLanguages), authorCountry, topics, stats);
        }
    }
}
