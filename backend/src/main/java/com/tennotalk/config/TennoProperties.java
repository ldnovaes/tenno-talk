package com.tennotalk.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Typed configuration under the {@code tenno.*} prefix. */
@ConfigurationProperties(prefix = "tenno")
public record TennoProperties(
        String publicUrl,
        String termsVersion,
        Media media,
        Translation translation,
        Ai ai,
        RateLimit rateLimit,
        OAuth oauth) {

    public record Media(String root) {}

    public record Translation(
            boolean workerEnabled,
            int batchSize,
            int maxAttempts,
            int contextMessages,
            Duration timeout,
            Duration cooldownDefault) {}

    /** AI providers in priority order: ChatGPT (codex) first, Claude as fallback. */
    public record Ai(List<Provider> providers, List<String> authErrorPatterns, List<String> quotaErrorPatterns) {}

    public record Provider(String id, List<String> command, List<String> statusCommand, List<String> loginCommand) {}

    public record RateLimit(boolean enabled) {}

    public record OAuth(Client google, Client facebook) {}

    public record Client(String clientId, String clientSecret) {
        public boolean configured() {
            return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
        }
    }
}
