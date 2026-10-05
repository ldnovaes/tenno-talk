package com.tennotalk.translation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

class TopicsJsonTest {

    private final List<String> taxonomy = List.of("travel", "food", "music", "art");

    @Test
    void keepsOnlyTaxonomyCodesOnceAndAtMostThree() {
        TopicsJson answer = new TopicsJson(Arrays.asList(" food ", "Food", "hacking", "food", null, "travel", "music", "art"));
        assertThat(answer.valid(taxonomy)).containsExactly("food", "travel", "music");
    }

    @Test
    void noTopicsIsAValidAnswer() {
        assertThat(new TopicsJson(null).valid(taxonomy)).isEmpty();
        assertThat(new TopicsJson(List.of()).valid(taxonomy)).isEmpty();
    }
}
