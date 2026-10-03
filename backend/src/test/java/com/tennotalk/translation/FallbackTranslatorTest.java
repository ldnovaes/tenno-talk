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
        public TranslationResult translate(TranslationRequest request) throws TranslatorException {
            calls++;
            TranslatorException next = script.poll();
            if (next != null) throw next;
            return new TranslationResult("ok-" + id, "lit-" + id, id);
        }
    }

    private final Instant now = Instant.parse("2026-10-03T12:00:00Z");
    private final ProviderStatusService status = mock(ProviderStatusService.class);
    private final Scripted codex = new Scripted("codex");
    private final Scripted claude = new Scripted("claude");
    private FallbackTranslator fallback;
    private final TranslationRequest request = TranslationRequest.of("Oi", "pt-BR", "vi-VN");

    @BeforeEach
    void setUp() {
        when(status.usable(anyString())).thenReturn(true);
        when(status.current(anyString())).thenAnswer(inv -> new ProviderState(inv.getArgument(0), "ok", null, null, now));
        fallback = new FallbackTranslator(List.of(codex, claude), status, Clock.fixed(now, ZoneOffset.UTC), Duration.ofMinutes(15));
    }

    private static TranslatorException error(TranslatorException.Kind kind) {
        return new TranslatorException(kind, kind.name());
    }

    @Test
    void chatGptIsThePrimaryProvider() {
        var outcome = fallback.translate(request);
        assertThat(outcome).isEqualTo(new TranslationOutcome.Success(new TranslationResult("ok-codex", "lit-codex", "codex")));
        assertThat(claude.calls).isZero();
        assertThat(fallback.providerIds()).containsExactly("codex", "claude");
    }

    @Test
    void loginFailureMarksReauthAndFallsBackToClaude() {
        codex.script.add(error(TranslatorException.Kind.AUTH));
        var outcome = fallback.translate(request);
        assertThat(((TranslationOutcome.Success) outcome).result().provider()).isEqualTo("claude");
        assertThat(codex.calls).isOne();
        verify(status).markNeedsReauth(eq("codex"), anyString());
        verify(status).markOk("claude");
    }

    @Test
    void quotaFailureCoolsDownUntilTheResetTime() {
        Instant reset = now.plusSeconds(3600);
        codex.script.add(new TranslatorException(TranslatorException.Kind.QUOTA, "limit", reset));
        fallback.translate(request);
        verify(status).markCoolingDown(eq("codex"), eq(reset), anyString());
    }

    @Test
    void quotaWithoutResetUsesTheDefaultCooldown() {
        codex.script.add(error(TranslatorException.Kind.QUOTA));
        fallback.translate(request);
        verify(status).markCoolingDown(eq("codex"), eq(now.plus(Duration.ofMinutes(15))), anyString());
    }

    @Test
    void aTransientErrorGetsOneMoreTryOnTheSameProvider() {
        codex.script.add(error(TranslatorException.Kind.TRANSIENT));
        var outcome = fallback.translate(request);
        assertThat(((TranslationOutcome.Success) outcome).result().provider()).isEqualTo("codex");
        assertThat(codex.calls).isEqualTo(2);
        assertThat(claude.calls).isZero();
    }

    @Test
    void unusableProvidersAreSkippedWithoutCalls() {
        when(status.usable("codex")).thenReturn(false);
        var outcome = fallback.translate(request);
        assertThat(((TranslationOutcome.Success) outcome).result().provider()).isEqualTo("claude");
        assertThat(codex.calls).isZero();
    }

    @Test
    void bothLoggedOutMeansUnavailableNotFailed() {
        codex.script.add(error(TranslatorException.Kind.AUTH));
        claude.script.add(error(TranslatorException.Kind.AUTH));
        assertThat(fallback.translate(request)).isInstanceOf(TranslationOutcome.Unavailable.class);
    }

    @Test
    void transientFailuresEverywhereMeanFailed() {
        for (int i = 0; i < 2; i++) {
            codex.script.add(error(TranslatorException.Kind.TRANSIENT));
            claude.script.add(error(TranslatorException.Kind.TRANSIENT));
        }
        assertThat(fallback.translate(request)).isInstanceOf(TranslationOutcome.Failed.class);
        verify(status, never()).markNeedsReauth(any(), any());
    }

    @Test
    void mixedLoginAndTransientFailuresAreRetriedLater() {
        codex.script.add(error(TranslatorException.Kind.AUTH));
        claude.script.add(error(TranslatorException.Kind.TRANSIENT));
        claude.script.add(error(TranslatorException.Kind.TRANSIENT));
        assertThat(fallback.translate(request)).isInstanceOf(TranslationOutcome.Failed.class);
    }
}
