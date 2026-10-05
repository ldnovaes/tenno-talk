package com.tennotalk.translation;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ApiErrorsTest {

    private final Instant now = Instant.parse("2026-10-04T12:00:00Z");

    @ParameterizedTest
    @CsvSource({
            "401, invalid_api_key, AUTH",
            "403, permission_error, AUTH",
            "429, rate_limit_exceeded, QUOTA",
            "429, insufficient_quota, QUOTA",
            "402, billing_error, QUOTA",
            "400, billing_error, QUOTA",
            "500, api_error, TRANSIENT",
            "529, overloaded_error, TRANSIENT",
            "400, invalid_request_error, TRANSIENT",
            "404, not_found_error, TRANSIENT",
    })
    void classifiesByStatusAndCode(int status, String code, TranslatorException.Kind kind) {
        assertThat(ApiErrors.classify("openai", status, code, null, "boom", now).kind()).isEqualTo(kind);
    }

    @Test
    void aRateLimitComesBackAfterTheRetryAfterHeaderOrAMinute() {
        assertThat(ApiErrors.classify("openai", 429, null, "30", "slow down", now).retryAt()).isEqualTo(now.plusSeconds(30));
        assertThat(ApiErrors.classify("openai", 429, null, "0.4", "slow down", now).retryAt()).isEqualTo(now.plusSeconds(1));
        assertThat(ApiErrors.classify("openai", 429, null, null, "slow down", now).retryAt()).isEqualTo(now.plusSeconds(60));
        assertThat(ApiErrors.classify("openai", 429, null, "Wed, 21 Oct 2026 07:28:00 GMT", "x", now).retryAt())
                .isEqualTo(now.plus(ApiErrors.DEFAULT_RETRY));
    }

    @Test
    void exhaustedCreditsHaveNoResetTimeSoTheDefaultCooldownApplies() {
        assertThat(ApiErrors.classify("openai", 429, "insufficient_quota", "30", "no credits", now).retryAt()).isNull();
    }

    @Test
    void theMessageNamesTheProviderAndStatusAndStaysShort() {
        var exception = ApiErrors.classify("anthropic", 529, "overloaded_error", null, "x".repeat(1000), now);
        assertThat(exception.getMessage()).startsWith("anthropic 529 overloaded_error: ").hasSizeLessThan(400);
    }

    @Test
    void retryAfterIgnoresNonsense() {
        assertThat(ApiErrors.retryAfterSeconds("-5")).isEmpty();
        assertThat(ApiErrors.retryAfterSeconds(" ")).isEmpty();
        assertThat(ApiErrors.retryAfterSeconds("12")).hasValue(Duration.ofSeconds(12));
    }
}
