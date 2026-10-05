package com.tennotalk.support;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import com.tennotalk.common.Languages;
import com.tennotalk.translation.AnthropicTranslator;
import com.tennotalk.translation.ApiErrors;
import com.tennotalk.translation.OpenAiTranslator;
import com.tennotalk.translation.TopicClassifier;
import com.tennotalk.translation.TranslationRequest;
import com.tennotalk.translation.TranslationResult;
import com.tennotalk.translation.Translator;
import com.tennotalk.translation.TranslatorException;

/**
 * Stands in for the OpenAI and Anthropic APIs. Translates deterministically as
 * "[target] text", labels topics with the taxonomy codes written in the caption, and can simulate every
 * failure of PLAN.md §28.3.
 */
public class FakeTranslators {

    public enum Mode { OK, AUTH, QUOTA, CREDITS, TRANSIENT, GARBAGE }

    private record Call(String provider, TranslationRequest request) {}

    private final Map<String, Mode> modes = new ConcurrentHashMap<>();
    private final Map<String, Boolean> checkOk = new ConcurrentHashMap<>();
    private final List<Call> calls = new CopyOnWriteArrayList<>();
    private final List<String> checks = new CopyOnWriteArrayList<>();
    private final List<String> classifications = new CopyOnWriteArrayList<>();

    public List<Translator> translators() {
        return List.of(new Fake(OpenAiTranslator.ID, "gpt-test"), new Fake(AnthropicTranslator.ID, "claude-test"));
    }

    public void reset() {
        modes.clear();
        checkOk.clear();
        calls.clear();
        checks.clear();
        classifications.clear();
    }

    public void mode(String provider, Mode mode) {
        modes.put(provider, mode);
    }

    /** What the model lookup of {@code check()} answers (default: the key works). */
    public void checkOk(String provider, boolean ok) {
        checkOk.put(provider, ok);
    }

    public long translationCalls(String provider) {
        return calls.stream().filter(call -> call.provider().equals(provider)).count();
    }

    public long classificationCalls(String provider) {
        return classifications.stream().filter(provider::equals).count();
    }

    public long checkCalls(String provider) {
        return checks.stream().filter(provider::equals).count();
    }

    public TranslationRequest lastRequest(String provider) {
        return calls.reversed().stream().filter(call -> call.provider().equals(provider)).map(Call::request)
                .findFirst().orElse(null);
    }

    private final class Fake implements Translator, TopicClassifier {

        private final String id;
        private final String model;

        Fake(String id, String model) {
            this.id = id;
            this.model = model;
        }

        @Override
        public String id() {
            return id;
        }

        @Override
        public String model() {
            return model;
        }

        @Override
        public TranslationResult translate(TranslationRequest request) throws TranslatorException {
            calls.add(new Call(id, request));
            Instant now = Instant.now();
            return switch (modes.getOrDefault(id, Mode.OK)) {
                case OK -> {
                    String language = Languages.displayName(request.targetLanguage());
                    yield new TranslationResult("[" + language + "] " + request.text(),
                            "[" + language + " literal] " + request.text(), id);
                }
                case AUTH -> throw ApiErrors.classify(id, 401, "authentication_error", null, "invalid x-api-key", now);
                case QUOTA -> throw ApiErrors.classify(id, 429, "rate_limit_error", "120", "rate limited", now);
                case CREDITS -> throw ApiErrors.classify(id, 429, "insufficient_quota", null, "no credits", now);
                case TRANSIENT -> throw ApiErrors.classify(id, 529, "overloaded_error", null, "overloaded", now);
                case GARBAGE -> throw ApiErrors.transientFailure(id, "empty translation");
            };
        }

        @Override
        public List<String> classifyTopics(String caption, List<String> taxonomy) throws TranslatorException {
            classifications.add(id);
            Instant now = Instant.now();
            return switch (modes.getOrDefault(id, Mode.OK)) {
                case OK -> taxonomy.stream().filter(code -> caption.toLowerCase(java.util.Locale.ROOT).contains(code)).limit(3).toList();
                case AUTH -> throw ApiErrors.classify(id, 401, "authentication_error", null, "invalid x-api-key", now);
                case QUOTA -> throw ApiErrors.classify(id, 429, "rate_limit_error", "120", "rate limited", now);
                case CREDITS -> throw ApiErrors.classify(id, 429, "insufficient_quota", null, "no credits", now);
                case TRANSIENT -> throw ApiErrors.classify(id, 529, "overloaded_error", null, "overloaded", now);
                case GARBAGE -> throw ApiErrors.transientFailure(id, "empty answer");
            };
        }

        @Override
        public void check() throws TranslatorException {
            checks.add(id);
            if (!checkOk.getOrDefault(id, true)) {
                throw ApiErrors.classify(id, 401, "authentication_error", null, "invalid x-api-key", Instant.now());
            }
        }
    }
}
