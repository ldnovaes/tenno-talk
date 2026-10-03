package com.tennotalk.translation;

/** Result of trying every provider in order. */
public sealed interface TranslationOutcome {

    record Success(TranslationResult result) implements TranslationOutcome {}

    /** Every provider is logged out or out of quota: wait, don't burn attempts (PLAN.md §28.3). */
    record Unavailable(String reason) implements TranslationOutcome {}

    /** At least one provider failed transiently: retry with backoff. */
    record Failed(String error) implements TranslationOutcome {}
}
