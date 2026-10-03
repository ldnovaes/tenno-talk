package com.tennotalk.translation;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import com.tennotalk.common.ApiException;
import com.tennotalk.config.TennoProperties;

/**
 * Re-authentication of the AI CLIs (PLAN.md §28.3):
 * 1. automatic: the CLI refreshes its own session; we check its status;
 * 2. assisted: start the CLI login (link + code) and let the admin approve it.
 */
@Service
public class ReauthService {

    public record Challenge(String provider, String verificationUrl, String userCode, List<String> output) {}

    private static final Logger log = LoggerFactory.getLogger(ReauthService.class);
    private static final Pattern URL = Pattern.compile("https?://\\S+");
    private static final Pattern CODE = Pattern.compile("\\b([A-Z0-9]{4,}-[A-Z0-9]{4,})\\b");
    private static final Duration AUTO_CHECK_INTERVAL = Duration.ofMinutes(10);
    private static final Duration STATUS_TIMEOUT = Duration.ofSeconds(20);

    private final ProcessRunner runner;
    private final ProviderStatusService status;
    private final AdminNotifier notifier;
    private final Map<String, TennoProperties.Provider> providers;
    private final Map<String, Instant> lastAutoCheck = new ConcurrentHashMap<>();
    private final Map<String, ProcessRunner.LongRunningProcess> logins = new ConcurrentHashMap<>();
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private final Clock clock;

    public ReauthService(ProcessRunner runner, ProviderStatusService status, AdminNotifier notifier,
            TennoProperties properties, Clock clock) {
        this.runner = runner;
        this.status = status;
        this.notifier = notifier;
        this.clock = clock;
        this.providers = new ConcurrentHashMap<>();
        properties.ai().providers().forEach(provider -> providers.put(provider.id(), provider));
    }

    @EventListener
    public void onNeedsReauth(ProviderNeedsReauth event) {
        executor.submit(() -> automaticCheck(event.provider(), event.error()));
    }

    /** Asks the CLI whether its session is still valid (it refreshes tokens by itself). */
    public boolean automaticCheck(String provider, String reason) {
        Instant now = clock.instant();
        Instant last = lastAutoCheck.get(provider);
        if (last != null && last.plus(AUTO_CHECK_INTERVAL).isAfter(now)) return false;
        lastAutoCheck.put(provider, now);
        TennoProperties.Provider config = providers.get(provider);
        if (config != null && config.statusCommand() != null && !config.statusCommand().isEmpty()) {
            try {
                if (runner.run(config.statusCommand(), STATUS_TIMEOUT).exitCode() == 0) {
                    status.markOk(provider);
                    return true;
                }
            } catch (Exception exception) {
                log.info("Status check of {} failed: {}", provider, exception.getMessage());
            }
        }
        notifier.reauthNeeded(provider, reason);
        return false;
    }

    /** Forgets when providers were last checked (tests share one application context). */
    public void clearThrottle() {
        lastAutoCheck.clear();
    }

    /** Admin-triggered check: ignores the automatic throttle. */
    public boolean checkNow(String provider) {
        lastAutoCheck.remove(provider);
        return automaticCheck(provider, "Manual check");
    }

    /** Starts the CLI login and returns the link/code for the admin (approved from the phone). */
    public Challenge startAssisted(String provider) {
        TennoProperties.Provider config = Optional.ofNullable(providers.get(provider))
                .orElseThrow(() -> ApiException.notFound("Unknown provider."));
        Optional.ofNullable(logins.remove(provider)).ifPresent(ProcessRunner.LongRunningProcess::destroy);
        ProcessRunner.LongRunningProcess process;
        try {
            process = runner.start(config.loginCommand());
        } catch (IOException exception) {
            throw new ApiException(com.tennotalk.common.ErrorCode.UNKNOWN, "Could not start the login: " + exception.getMessage());
        }
        logins.put(provider, process);
        status.markReauthPending(provider);
        Challenge challenge = readChallenge(provider, process);
        notifier.reauthChallenge(provider, challenge.verificationUrl(), challenge.userCode());
        executor.submit(() -> awaitLogin(provider, process));
        return challenge;
    }

    private Challenge readChallenge(String provider, ProcessRunner.LongRunningProcess process) {
        List<String> lines = new ArrayList<>();
        String url = null;
        String code = null;
        var reader = process.output();
        try {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30);
            String line;
            while ((url == null || code == null) && System.nanoTime() < deadline && (line = reader.readLine()) != null) {
                lines.add(line);
                Matcher urlMatcher = URL.matcher(line);
                if (url == null && urlMatcher.find()) url = urlMatcher.group();
                Matcher codeMatcher = CODE.matcher(line);
                if (code == null && codeMatcher.find()) code = codeMatcher.group(1);
            }
        } catch (IOException exception) {
            log.info("Reading the {} login output failed: {}", provider, exception.getMessage());
        }
        return new Challenge(provider, url, code, lines);
    }

    private void awaitLogin(String provider, ProcessRunner.LongRunningProcess process) {
        try {
            int exit = process.waitFor();
            if (logins.get(provider) != process) return;
            logins.remove(provider);
            if (exit == 0) {
                log.info("AI provider {} logged in again", provider);
                status.markOk(provider);
            } else {
                status.markNeedsReauth(provider, "Login did not complete (exit " + exit + ")");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
