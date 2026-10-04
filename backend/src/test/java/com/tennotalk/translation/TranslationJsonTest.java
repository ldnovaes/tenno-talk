package com.tennotalk.translation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TranslationJsonTest {

    @Test
    void trimsBothTranslations() {
        assertThat(new TranslationJson(" Anh nhớ em. ", " Tôi nhớ bạn. ").toResult("openai"))
                .hasValue(new TranslationResult("Anh nhớ em.", "Tôi nhớ bạn.", "openai"));
    }

    @Test
    void anEmptyLiteralFallsBackToTheNaturalTranslation() {
        assertThat(new TranslationJson("Hi", null).toResult("anthropic")).hasValue(new TranslationResult("Hi", "Hi", "anthropic"));
        assertThat(new TranslationJson("Hi", "  ").toResult("anthropic")).hasValue(new TranslationResult("Hi", "Hi", "anthropic"));
    }

    @Test
    void anEmptyNaturalTranslationIsNoTranslation() {
        assertThat(new TranslationJson(" ", "x").toResult("openai")).isEmpty();
        assertThat(new TranslationJson(null, null).toResult("openai")).isEmpty();
    }
}
