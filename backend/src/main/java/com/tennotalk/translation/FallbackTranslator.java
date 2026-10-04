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
        List<String> transientErrors = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        for (Translator provider : providers) {
            if (!status.usable(provider.id())) {
                skipped.add(provider.id() + ": " + status.current(provider.id()).state());
                continue;
            }
            for (int attempt = 1; attempt <= 2; attempt++) {
                try {
                    TranslationResult result = provider.translate(request);
                    status.markOk(provider.id());
                    return new TranslationOutcome.Success(result);
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
        if (!transientErrors.isEmpty()) return new TranslationOutcome.Failed(String.join("; ", transientErrors));
        return new TranslationOutcome.Unavailable(String.join("; ", skipped));
    }
}
