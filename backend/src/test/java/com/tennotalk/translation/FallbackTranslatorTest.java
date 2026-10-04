package com.tennotalk.translation;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FallbackTranslatorTest {

    /** Scripted provider: each call pops the next outcome (null = success). */
    static final class Scripted implements Translator {
        final String id;
        final Deque<TranslatorException> script = new ArrayDeque<>();
        int calls;

        Scripted(String id) {
            this.id = id;
        }

        @Override
        public String id() {
            return id;
        }

        @Override
        public String model() {
            return id + "-model";
        }

        @Override
        public void check() {}

        @Override
        public TranslationResult translate(TranslationRequest request) throws TranslatorException {
            calls++;
            TranslatorException next = script.poll();
            if (next != null) throw next;
            return new TranslationResult("ok-" + id, "lit-" + id, id);
        }
    }

    private final Instant now = Instant.parse("2026-10-03T12:00:00Z");
    private final ProviderStatusService status = mock(ProviderStatusService.class);
    private final Scripted openai = new Scripted("openai");
    private final Scripted anthropic = new Scripted("anthropic");
    private FallbackTranslator fallback;
    private final TranslationRequest request = TranslationRequest.of("Oi", "pt-BR", "vi-VN");

    @BeforeEach
    void setUp() {
        when(status.usable(anyString())).thenReturn(true);
        when(status.current(anyString())).thenAnswer(inv -> new ProviderState(inv.getArgument(0), "ok", null, null, now));
        fallback = new FallbackTranslator(List.of(openai, anthropic), status, Clock.fixed(now, ZoneOffset.UTC), Duration.ofMinutes(15));
    }

    private static TranslatorException error(TranslatorException.Kind kind) {
        return new TranslatorException(kind, kind.name());
    }

    @Test
    void openAiIsThePrimaryProvider() {
        var outcome = fallback.translate(request);
        assertThat(outcome).isEqualTo(new TranslationOutcome.Success(new TranslationResult("ok-openai", "lit-openai", "openai")));
        assertThat(anthropic.calls).isZero();
        assertThat(fallback.providerIds()).containsExactly("openai", "anthropic");
    }

    @Test
    void aRejectedKeyMarksTheProviderInvalidAndFallsBackToAnthropic() {
        openai.script.add(error(TranslatorException.Kind.AUTH));
        var outcome = fallback.translate(request);
        assertThat(((TranslationOutcome.Success) outcome).result().provider()).isEqualTo("anthropic");
        assertThat(openai.calls).isOne();
        verify(status).markInvalidKey(eq("openai"), anyString());
        verify(status).markOk("anthropic");
    }

    @Test
    void quotaFailureCoolsDownUntilTheResetTime() {
        Instant reset = now.plusSeconds(3600);
        openai.script.add(new TranslatorException(TranslatorException.Kind.QUOTA, "limit", reset));
        fallback.translate(request);
        verify(status).markCoolingDown(eq("openai"), eq(reset), anyString());
    }

    @Test
    void quotaWithoutResetIsOutOfCreditsAndUsesTheDefaultCooldown() {
        openai.script.add(error(TranslatorException.Kind.QUOTA));
        fallback.translate(request);
        verify(status).markOutOfCredits(eq("openai"), eq(now.plus(Duration.ofMinutes(15))), anyString());
    }

    @Test
    void aTransientErrorGetsOneMoreTryOnTheSameProvider() {
        openai.script.add(error(TranslatorException.Kind.TRANSIENT));
        var outcome = fallback.translate(request);
        assertThat(((TranslationOutcome.Success) outcome).result().provider()).isEqualTo("openai");
        assertThat(openai.calls).isEqualTo(2);
        assertThat(anthropic.calls).isZero();
    }

    @Test
    void unusableProvidersAreSkippedWithoutCalls() {
        when(status.usable("openai")).thenReturn(false);
        var outcome = fallback.translate(request);
        assertThat(((TranslationOutcome.Success) outcome).result().provider()).isEqualTo("anthropic");
        assertThat(openai.calls).isZero();
    }

    @Test
    void bothKeysRejectedMeansUnavailableNotFailed() {
        openai.script.add(error(TranslatorException.Kind.AUTH));
        anthropic.script.add(error(TranslatorException.Kind.AUTH));
        assertThat(fallback.translate(request)).isInstanceOf(TranslationOutcome.Unavailable.class);
    }

    @Test
    void transientFailuresEverywhereMeanFailed() {
        for (int i = 0; i < 2; i++) {
            openai.script.add(error(TranslatorException.Kind.TRANSIENT));
            anthropic.script.add(error(TranslatorException.Kind.TRANSIENT));
        }
        assertThat(fallback.translate(request)).isInstanceOf(TranslationOutcome.Failed.class);
        verify(status, never()).markInvalidKey(any(), any());
    }

    @Test
    void mixedKeyAndTransientFailuresAreRetriedLater() {
        openai.script.add(error(TranslatorException.Kind.AUTH));
        anthropic.script.add(error(TranslatorException.Kind.TRANSIENT));
        anthropic.script.add(error(TranslatorException.Kind.TRANSIENT));
        assertThat(fallback.translate(request)).isInstanceOf(TranslationOutcome.Failed.class);
    }
}
