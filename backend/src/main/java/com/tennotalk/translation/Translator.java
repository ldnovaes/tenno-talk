package com.tennotalk.translation;

/** A translation provider. New providers (e.g. an API) are just new implementations. */
public interface Translator {

    String id();

    TranslationResult translate(TranslationRequest request) throws TranslatorException;
}
