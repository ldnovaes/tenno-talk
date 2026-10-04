package com.tennotalk.admin;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.common.ApiException;
import com.tennotalk.config.TennoProperties;
import com.tennotalk.translation.AnthropicTranslator;
import com.tennotalk.translation.OpenAiTranslator;
import com.tennotalk.translation.ProviderHealthService;
import com.tennotalk.translation.ProviderState;
import com.tennotalk.translation.ProviderStatusService;
import com.tennotalk.translation.TranslationJobRepository;

/** AI provider health (PLAN.md §28.3). Admins only (SecurityConfig). */
@RestController
@RequestMapping("/api/admin/ai")
public class AdminAiController {

    /** A provider without a key is shown as {@code not_configured}; that state is never stored. */
    static final String NOT_CONFIGURED = "not_configured";

    public record ProviderView(String provider, String model, String state, Instant until, String lastError, Instant checkedAt) {}

    public record AiStatus(List<ProviderView> providers, Map<String, Long> queue) {}

    public record CheckResult(boolean ok, ProviderView provider) {}

    private final ProviderStatusService status;
    private final ProviderHealthService health;
    private final TranslationJobRepository jobs;
    private final TennoProperties properties;

    public AdminAiController(ProviderStatusService status, ProviderHealthService health, TranslationJobRepository jobs,
            TennoProperties properties) {
        this.status = status;
        this.health = health;
        this.jobs = jobs;
        this.properties = properties;
    }

    @GetMapping
    public AiStatus status() {
        return new AiStatus(status.all().stream().map(this::view).toList(), jobs.countsByStatus());
    }

    /** Looks the model up now (no tokens spent): confirms the key after it was replaced. */
    @PostMapping("/{provider}/check")
    public CheckResult check(@PathVariable String provider) {
        if (status.all().stream().noneMatch(p -> p.provider().equals(provider))) throw ApiException.notFound("Unknown provider.");
        if (health.find(provider).isEmpty()) throw ApiException.validation("This provider has no API key.");
        boolean ok = health.checkNow(provider);
        return new CheckResult(ok, view(status.current(provider)));
    }

    private ProviderView view(ProviderState state) {
        return health.find(state.provider())
                .map(translator -> new ProviderView(state.provider(), translator.model(), state.state(), state.until(),
                        state.lastError(), state.checkedAt()))
                .orElseGet(() -> new ProviderView(state.provider(), configuredModel(state.provider()), NOT_CONFIGURED,
                        null, null, null));
    }

    private String configuredModel(String provider) {
        if (OpenAiTranslator.ID.equals(provider)) return properties.ai().openai().model();
        if (AnthropicTranslator.ID.equals(provider)) return properties.ai().anthropic().model();
        return null;
    }
}
