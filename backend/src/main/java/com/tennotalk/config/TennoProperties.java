package com.tennotalk.config;

import java.time.Duration;

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

    /** Translation providers (PLAN.md §28.1): OpenAI first, Anthropic as fallback. */
    public record Ai(int maxOutputTokens, Provider openai, Provider anthropic) {}

    /** One API account. {@code baseUrl} is only set by tests (stub server). */
    public record Provider(String apiKey, String model, String baseUrl) {
        public boolean configured() {
            return apiKey != null && !apiKey.isBlank();
        }
    }

    public record RateLimit(boolean enabled) {}

    public record OAuth(Client google, Client facebook) {}

    public record Client(String clientId, String clientSecret) {
        public boolean configured() {
            return clientId != null && !clientId.isBlank() && clientSecret != null && !clientSecret.isBlank();
        }
    }
}
