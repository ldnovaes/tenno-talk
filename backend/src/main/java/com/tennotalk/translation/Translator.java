package com.tennotalk.translation;

/** A translation provider (PLAN.md §28.1): the OpenAI or the Anthropic API. */
public interface Translator {

    String id();

    /** The model this provider calls; shown in the admin panel. */
    String model();

    TranslationResult translate(TranslationRequest request) throws TranslatorException;

    /** Confirms the key and the model without spending tokens. */
    void check() throws TranslatorException;
}
