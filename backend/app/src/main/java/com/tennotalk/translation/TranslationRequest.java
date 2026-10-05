package com.tennotalk.translation;

import java.util.List;

/** One text to translate plus a few previous messages for context (PLAN.md §28.2). */
public record TranslationRequest(String text, String sourceLanguage, String targetLanguage, List<ContextLine> context) {

    public record ContextLine(String speaker, String text) {}

    public static TranslationRequest of(String text, String source, String target) {
        return new TranslationRequest(text, source, target, List.of());
    }
}
