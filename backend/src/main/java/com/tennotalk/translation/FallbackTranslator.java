package com.tennotalk.translation;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * ChatGPT first; Claude only when ChatGPT fails (PLAN.md §28.3):
 * login problems trigger re-authentication, quota problems a cooldown, transient
 * errors one more try before moving on. Providers that are down are skipped.
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
                        log.warn("AI provider {} needs re-authentication: {}", provider.id(), exception.getMessage());
                        status.markNeedsReauth(provider.id(), exception.getMessage());
                        skipped.add(provider.id() + ": login");
                        break;
                    }
                    if (exception.kind() == TranslatorException.Kind.QUOTA) {
                        var until = exception.retryAt() != null ? exception.retryAt() : clock.instant().plus(defaultCooldown);
                        log.warn("AI provider {} is out of quota until {}", provider.id(), until);
                        status.markCoolingDown(provider.id(), until, exception.getMessage());
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
