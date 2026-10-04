package com.tennotalk.translation;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Maps an API failure to the fallback rules of PLAN.md §28.3. Both SDKs expose the
 * same facts (status, error code, retry-after), so the rule lives here once.
 */
public final class ApiErrors {

    /** Used when a 429 does not say when to come back. */
    static final Duration DEFAULT_RETRY = Duration.ofSeconds(60);

    private ApiErrors() {}

    /**
     * @param code OpenAI {@code error.code} or Anthropic {@code error.type}, when present
     * @param retryAfter the {@code retry-after} header, when present
     */
    public static TranslatorException classify(String provider, int status, String code, String retryAfter,
            String message, Instant now) {
        String text = provider + " " + status + (code == null ? "" : " " + code) + ": " + abbreviate(message);
        if (status == 401 || status == 403) {
            return new TranslatorException(TranslatorException.Kind.AUTH, text);
        }
        if ("insufficient_quota".equals(code) || "billing_error".equals(code) || status == 402) {
            // Credits exhausted: no retryAt, so the default cooldown applies and the admin is told.
            return new TranslatorException(TranslatorException.Kind.QUOTA, text);
        }
        if (status == 429) {
            Duration wait = retryAfterSeconds(retryAfter).orElse(DEFAULT_RETRY);
            return new TranslatorException(TranslatorException.Kind.QUOTA, text, now.plus(wait));
        }
        return new TranslatorException(TranslatorException.Kind.TRANSIENT, text);
    }

    public static TranslatorException transientFailure(String provider, String message) {
        return new TranslatorException(TranslatorException.Kind.TRANSIENT, provider + ": " + abbreviate(message));
    }

    /** Whole seconds only; the HTTP-date form is rare on these APIs and falls back to the default. */
    static Optional<Duration> retryAfterSeconds(String header) {
        if (header == null || header.isBlank()) return Optional.empty();
        try {
            long seconds = (long) Math.ceil(Double.parseDouble(header.trim()));
            return seconds > 0 ? Optional.of(Duration.ofSeconds(seconds)) : Optional.empty();
        } catch (NumberFormatException exception) {
            return Optional.empty();
        }
    }

    static String abbreviate(String text) {
        String flat = text == null ? "" : text.replaceAll("\\s+", " ").trim();
        return flat.length() > 300 ? flat.substring(0, 300) + "…" : flat;
    }
}
