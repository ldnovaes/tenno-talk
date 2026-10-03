package com.tennotalk.admin;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.common.ApiException;
import com.tennotalk.translation.ProviderState;
import com.tennotalk.translation.ProviderStatusService;
import com.tennotalk.translation.ReauthService;
import com.tennotalk.translation.TranslationJobRepository;

/** AI provider health and re-authentication (PLAN.md §28.3). Admins only (SecurityConfig). */
@RestController
@RequestMapping("/api/admin/ai")
public class AdminAiController {

    public record AiStatus(List<ProviderState> providers, Map<String, Long> queue) {}

    public record CheckResult(boolean ok, ProviderState provider) {}

    private final ProviderStatusService status;
    private final ReauthService reauth;
    private final TranslationJobRepository jobs;

    public AdminAiController(ProviderStatusService status, ReauthService reauth, TranslationJobRepository jobs) {
        this.status = status;
        this.reauth = reauth;
        this.jobs = jobs;
    }

    @GetMapping
    public AiStatus status() {
        return new AiStatus(status.all(), jobs.countsByStatus());
    }

    /** Runs the CLI status command now (the CLI may have refreshed its own token). */
    @PostMapping("/{provider}/check")
    public CheckResult check(@PathVariable String provider) {
        requireKnown(provider);
        boolean ok = reauth.checkNow(provider);
        return new CheckResult(ok, status.current(provider));
    }

    /** Starts the device login; the admin opens the link on the phone and types the code. */
    @PostMapping("/{provider}/reauth")
    public ReauthService.Challenge reauth(@PathVariable String provider) {
        requireKnown(provider);
        return reauth.startAssisted(provider);
    }

    private void requireKnown(String provider) {
        if (status.all().stream().noneMatch(p -> p.provider().equals(provider))) throw ApiException.notFound("Unknown provider.");
    }
}
