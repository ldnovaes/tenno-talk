package com.tennotalk.translation;

import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * Keys instead of logins (PLAN.md §28.3): the administrator is told when a provider
 * needs attention, and a cheap model lookup confirms that a provider works again.
 */
@Service
public class ProviderHealthService {

    private static final Logger log = LoggerFactory.getLogger(ProviderHealthService.class);

    private final List<Translator> translators;
    private final ProviderStatusService status;
    private final AdminNotifier notifier;

    public ProviderHealthService(List<Translator> translators, ProviderStatusService status, AdminNotifier notifier) {
        this.translators = List.copyOf(translators);
        this.status = status;
        this.notifier = notifier;
    }

    public List<Translator> configured() {
        return translators;
    }

    public Optional<Translator> find(String provider) {
        return translators.stream().filter(translator -> translator.id().equals(provider)).findFirst();
    }

    @EventListener
    public void onNeedsAttention(ProviderNeedsAttention event) {
        notifier.providerNeedsAttention(event.provider(), event.reason());
    }

    /** After a restart the key may have been replaced in Infisical: check the providers marked invalid. */
    @EventListener(ApplicationReadyEvent.class)
    public void checkInvalidKeysOnStartup() {
        for (Translator translator : translators) {
            if (ProviderState.INVALID_KEY.equals(status.current(translator.id()).state())) check(translator);
        }
    }

    /** Admin "Check now": true when the provider answered and is usable again. */
    public boolean checkNow(String provider) {
        return find(provider).map(this::check).orElse(false);
    }

    private boolean check(Translator translator) {
        try {
            translator.check();
            status.markOk(translator.id());
            return true;
        } catch (TranslatorException exception) {
            log.info("Check of AI provider {} failed: {}", translator.id(), exception.getMessage());
            if (exception.kind() == TranslatorException.Kind.AUTH) status.markInvalidKey(translator.id(), exception.getMessage());
            return false;
        }
    }
}
