package com.tennotalk.recommender.learning;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import net.jqwik.api.ForAll;
import net.jqwik.api.Property;

class HashtagsTest {

    @Test
    void extractsTagsInAnyScriptLowercasedAndOnce() {
        assertThat(Hashtags.extract("Café da manhã #Café #café #東京 #ภาษาไทย #Travel2026 #مرحبا"))
                .containsExactly("café", "東京", "ภาษาไทย", "travel2026", "مرحبا");
    }

    @Test
    void normalizesFullWidthCharacters() {
        assertThat(Hashtags.extract("＃ＴＲＡＶＥＬ")).containsExactly("travel");
    }

    @Test
    void skipsTooShortTooLongAndUnderscoreOnlyTags() {
        assertThat(Hashtags.extract("#a #__ #" + "x".repeat(51) + " #ok")).containsExactly("ok");
        assertThat(Hashtags.extract("#" + "y".repeat(50))).hasSize(1);
    }

    @Test
    void keepsAtMostThirtyTags() {
        StringBuilder caption = new StringBuilder();
        for (int i = 0; i < 40; i++) caption.append(" #tag").append(i);
        assertThat(Hashtags.extract(caption.toString())).hasSize(Hashtags.MAX_TAGS).startsWith("tag0").endsWith("tag29");
    }

    @Test
    void emptyOrNullCaptionsHaveNoTags() {
        assertThat(Hashtags.extract(null)).isEmpty();
        assertThat(Hashtags.extract("")).isEmpty();
        assertThat(Hashtags.extract("no tags # here")).isEmpty();
    }

    @Test
    void topicsIncludeEveryTagAndTheTaxonomyCodesTheyName() {
        assertThat(Hashtags.topics("Tokyo trip #travel #Language_Learning #東京")).containsExactlyInAnyOrderEntriesOf(Map.of(
                "tag:travel", 1.0, "travel", 1.0, "tag:language_learning", 1.0, "language-learning", 1.0, "tag:東京", 1.0));
    }

    @Property(tries = 500)
    void neverThrowsAndRespectsTheLimits(@ForAll String caption) {
        assertThat(Hashtags.extract(caption)).hasSizeLessThanOrEqualTo(Hashtags.MAX_TAGS).doesNotHaveDuplicates()
                .allSatisfy(tag -> assertThat(tag.codePointCount(0, tag.length())).isBetween(Hashtags.MIN_LENGTH, Hashtags.MAX_LENGTH));
    }
}
