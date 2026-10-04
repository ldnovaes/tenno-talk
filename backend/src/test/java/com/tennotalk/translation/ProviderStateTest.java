package com.tennotalk.translation;

import java.time.Instant;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ProviderStateTest {

    private final Instant now = Instant.parse("2026-10-03T12:00:00Z");

    @Test
    void okIsUsable() {
        assertThat(new ProviderState("openai", "ok", null, null, now).usable(now)).isTrue();
    }

    @Test
    void anInvalidKeyIsNotUsable() {
        assertThat(new ProviderState("openai", "invalid_key", null, null, now).usable(now)).isFalse();
    }

    @Test
    void coolingDownEndsAtItsDeadline() {
        assertThat(new ProviderState("openai", "cooling_down", now.plusSeconds(1), null, now).usable(now)).isFalse();
        assertThat(new ProviderState("openai", "cooling_down", now, null, now).usable(now)).isTrue();
        assertThat(new ProviderState("openai", "cooling_down", null, null, now).usable(now)).isFalse();
    }

    @Test
    void backoffGrowsAndIsCapped() {
        assertThat(TranslationWorker.backoff(0)).hasSeconds(5);
        assertThat(TranslationWorker.backoff(1)).hasSeconds(10);
        assertThat(TranslationWorker.backoff(3)).hasSeconds(40);
        assertThat(TranslationWorker.backoff(50)).hasSeconds(320);
    }
}
