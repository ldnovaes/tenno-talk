package com.tennotalk.translation;

/** Result of asking the providers in order for any AI task (translation, topics). */
public sealed interface ProviderOutcome<T> {

    record Success<T>(T value) implements ProviderOutcome<T> {}

    /** Every provider is logged out or out of quota: wait, don't burn attempts (PLAN.md §28.3). */
    record Unavailable<T>(String reason) implements ProviderOutcome<T> {}

    /** At least one provider failed transiently: retry with backoff. */
    record Failed<T>(String error) implements ProviderOutcome<T> {}
}
