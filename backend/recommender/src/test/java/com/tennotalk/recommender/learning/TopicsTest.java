package com.tennotalk.recommender.learning;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TopicsTest {

    @Test
    void taxonomyIsKebabCaseAndUnique() {
        assertThat(Topics.ALL).hasSize(50).doesNotHaveDuplicates().allMatch(code -> code.matches("[a-z]+(-[a-z]+)*"));
        assertThat(Topics.VERSION).isNotBlank();
    }

    @Test
    void recognizesCodes() {
        assertThat(Topics.isTopic("travel")).isTrue();
        assertThat(Topics.isTopic("Travel")).isFalse();
        assertThat(Topics.isTopic(null)).isFalse();
    }

    @Test
    void hashtagsNameTopicsWhateverTheSeparator() {
        assertThat(Topics.fromHashtag("languagelearning")).contains("language-learning");
        assertThat(Topics.fromHashtag("Language_Learning")).contains("language-learning");
        assertThat(Topics.fromHashtag("STUDY-ABROAD")).contains("study-abroad");
        assertThat(Topics.fromHashtag("travel2026")).isEmpty();
        assertThat(Topics.fromHashtag(null)).isEmpty();
    }
}
