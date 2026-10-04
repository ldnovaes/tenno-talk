package com.tennotalk.translation;

import java.util.Optional;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

/** The structured answer both APIs must return (their SDKs derive the JSON schema from it). */
public record TranslationJson(
        @JsonPropertyDescription("Natural translation, the way a native speaker would say it") String natural,
        @JsonPropertyDescription("Word-by-word translation in the same target language") String literal) {

    /** An empty natural text is not a translation; an empty literal falls back to the natural one. */
    public Optional<TranslationResult> toResult(String provider) {
        String text = natural == null ? "" : natural.trim();
        if (text.isEmpty()) return Optional.empty();
        String word = literal == null ? "" : literal.trim();
        return Optional.of(new TranslationResult(text, word.isEmpty() ? text : word, provider));
    }
}
