package com.tennotalk.translation;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ApiErrorsTest {

    private final Instant now = Instant.parse("2026-10-04T12:00:00Z");

    static java.util.stream.Stream<org.junit.jupiter.params.provider.Arguments> everyStatusAndCode() {
        var rows = new java.util.ArrayList<org.junit.jupiter.params.provider.Arguments>();
        for (int status : new int[] {400, 401, 402, 403, 404, 408, 409, 413, 422, 429, 500, 502, 503, 504, 529})
            for (String code : java.util.Arrays.asList(null, "invalid_api_key", "insufficient_quota", "billing_error",
                    "rate_limit_exceeded", "overloaded_error", "invalid_request_error"))
                rows.add(org.junit.jupiter.params.provider.Arguments.of(status, code));
        return rows.stream();
    }

    /**
     * PLAN.md §28.3, in order: a rejected key (401/403) is the admin's problem whatever else the error says;
     * exhausted credits (insufficient_quota, billing_error, 402) cool down for the default period; a rate limit
     * (429) comes back when the API says; anything else is transient and retried.
     */
    @ParameterizedTest(name = "{0} {1}")
    @org.junit.jupiter.params.provider.MethodSource("everyStatusAndCode")
    void classifiesEveryStatusAndCode(int status, String code) {
        TranslatorException.Kind expected;
        boolean timed = false;
        if (status == 401 || status == 403) expected = TranslatorException.Kind.AUTH;
        else if ("insufficient_quota".equals(code) || "billing_error".equals(code) || status == 402) expected = TranslatorException.Kind.QUOTA;
        else if (status == 429) {
            expected = TranslatorException.Kind.QUOTA;
            timed = true;
        } else expected = TranslatorException.Kind.TRANSIENT;

        var exception = ApiErrors.classify("openai", status, code, "30", "boom", now);
        assertThat(exception.kind()).isEqualTo(expected);
        assertThat(exception.retryAt()).isEqualTo(timed ? now.plusSeconds(30) : null);
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
