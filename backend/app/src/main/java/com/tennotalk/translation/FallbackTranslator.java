package com.tennotalk.translation;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * OpenAI first; Anthropic only when OpenAI fails (PLAN.md §28.3):
 * a rejected key marks the provider invalid, quota problems start a cooldown, transient
 * errors get one more try before moving on. Providers that are down are skipped.
 */
public class FallbackTranslator {

    private static final Logger log = LoggerFactory.getLogger(FallbackTranslator.class);

    private final List<Translator> providers;
    private final ProviderStatusService status;
    private final Clock clock;
    private final Duration defaultCooldown;

    public FallbackTranslator(List<Translator> providers, ProviderStatusService status, Clock clock, Duration defaultCooldown) {
        this.providers = List.copyOf(providers);
        this.status = status;
        this.clock = clock;
        this.defaultCooldown = defaultCooldown;
    }

    public List<String> providerIds() {
        return providers.stream().map(Translator::id).toList();
    }

    public TranslationOutcome translate(TranslationRequest request) {
        return switch (firstSuccess(provider -> provider.translate(request))) {
            case ProviderOutcome.Success<TranslationResult> success -> new TranslationOutcome.Success(success.value());
            case ProviderOutcome.Unavailable<TranslationResult> unavailable -> new TranslationOutcome.Unavailable(unavailable.reason());
            case ProviderOutcome.Failed<TranslationResult> failed -> new TranslationOutcome.Failed(failed.error());
        };
    }

    /** Topics for a post caption (PLAN.md §37.5), with the same provider order and failure rules as translation. */
    public ProviderOutcome<List<String>> classifyTopics(String caption, List<String> taxonomy) {
        return firstSuccess(provider -> {
            if (!(provider instanceof TopicClassifier classifier)) throw ApiErrors.transientFailure(provider.id(), "cannot classify topics");
            return classifier.classifyTopics(caption, taxonomy);
        });
    }

    @FunctionalInterface
    private interface ProviderCall<T> {
        T call(Translator provider) throws TranslatorException;
    }

    private <T> ProviderOutcome<T> firstSuccess(ProviderCall<T> call) {
        List<String> transientErrors = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        for (Translator provider : providers) {
            if (!status.usable(provider.id())) {
                skipped.add(provider.id() + ": " + status.current(provider.id()).state());
                continue;
            }
            for (int attempt = 1; attempt <= 2; attempt++) {
                try {
                    T result = call.call(provider);
                    status.markOk(provider.id());
                    return new ProviderOutcome.Success<>(result);
                } catch (TranslatorException exception) {
                    if (exception.kind() == TranslatorException.Kind.AUTH) {
                        log.warn("AI provider {} rejected its key: {}", provider.id(), exception.getMessage());
                        status.markInvalidKey(provider.id(), exception.getMessage());
                        skipped.add(provider.id() + ": key");
                        break;
                    }
                    if (exception.kind() == TranslatorException.Kind.QUOTA) {
                        log.warn("AI provider {} is out of quota: {}", provider.id(), exception.getMessage());
                        if (exception.retryAt() != null) {
                            status.markCoolingDown(provider.id(), exception.retryAt(), exception.getMessage());
                        } else {
                            // No reset time: credits are gone, so wait longer and tell the admin.
                            status.markOutOfCredits(provider.id(), clock.instant().plus(defaultCooldown), exception.getMessage());
                        }
                        skipped.add(provider.id() + ": quota");
                        break;
                    }
                    log.info("AI provider {} failed (attempt {}): {}", provider.id(), attempt, exception.getMessage());
                    if (attempt == 2) transientErrors.add(exception.getMessage());
                }
            }
        }
        if (!transientErrors.isEmpty()) return new ProviderOutcome.Failed<>(String.join("; ", transientErrors));
        return new ProviderOutcome.Unavailable<>(String.join("; ", skipped));
    }
}
