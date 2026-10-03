package com.tennotalk.translation;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeoutException;

import org.junit.jupiter.api.Test;

import com.tennotalk.config.TennoProperties;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CliTranslatorTest {

    /** Returns a fixed result, or throws, and records the command. */
    static final class StubRunner implements ProcessRunner {
        final List<List<String>> commands = new ArrayList<>();
        ProcessResult result;
        Exception failure;

        @Override
        public ProcessResult run(List<String> command, Duration timeout) throws IOException, TimeoutException {
            commands.add(command);
            if (failure instanceof IOException io) throw io;
            if (failure instanceof TimeoutException timeoutException) throw timeoutException;
            return result;
        }

        @Override
        public LongRunningProcess start(List<String> command) {
            throw new UnsupportedOperationException();
        }
    }

    private final StubRunner runner = new StubRunner();
    private final ErrorClassifier classifier = new ErrorClassifier(List.of("not logged in"), List.of("usage limit"));
    private final CliTranslator codex = new CliTranslator(
            new TennoProperties.Provider("codex", List.of("codex", "exec", "--skip-git-repo-check", "{prompt}"), List.of(), List.of()),
            runner, classifier, Duration.ofSeconds(5));
    private final TranslationRequest request = TranslationRequest.of("Oi", "pt-BR", "vi-VN");

    @Test
    void passesThePromptAsOneArgumentAndParsesTheAnswer() throws Exception {
        runner.result = new ProcessRunner.ProcessResult(0, "{\"natural\":\"Chào\",\"literal\":\"Xin chào\"}", "");
        TranslationResult result = codex.translate(request);
        assertThat(result).isEqualTo(new TranslationResult("Chào", "Xin chào", "codex"));
        List<String> command = runner.commands.getFirst();
        assertThat(command).hasSize(4).startsWith("codex", "exec", "--skip-git-repo-check");
        assertThat(command.get(3)).contains("<<<\nOi\n>>>");
    }

    @Test
    void loginErrorsAreAuth() {
        runner.result = new ProcessRunner.ProcessResult(1, "", "Error: not logged in");
        assertThatThrownBy(() -> codex.translate(request)).isInstanceOfSatisfying(TranslatorException.class,
                e -> assertThat(e.kind()).isEqualTo(TranslatorException.Kind.AUTH));
    }

    @Test
    void usageLimitsAreQuota() {
        runner.result = new ProcessRunner.ProcessResult(2, "You've hit your usage limit", "");
        assertThatThrownBy(() -> codex.translate(request)).isInstanceOfSatisfying(TranslatorException.class,
                e -> assertThat(e.kind()).isEqualTo(TranslatorException.Kind.QUOTA));
    }

    @Test
    void timeoutsMissingBinariesAndGarbageAreTransient() {
        runner.failure = new TimeoutException();
        assertThatThrownBy(() -> codex.translate(request)).isInstanceOfSatisfying(TranslatorException.class,
                e -> assertThat(e.kind()).isEqualTo(TranslatorException.Kind.TRANSIENT));
        runner.failure = new IOException("Cannot run program \"codex\"");
        assertThatThrownBy(() -> codex.translate(request)).isInstanceOfSatisfying(TranslatorException.class,
                e -> assertThat(e.getMessage()).contains("Cannot run program"));
        runner.failure = null;
        runner.result = new ProcessRunner.ProcessResult(0, "sorry", "");
        assertThatThrownBy(() -> codex.translate(request)).isInstanceOfSatisfying(TranslatorException.class,
                e -> assertThat(e.kind()).isEqualTo(TranslatorException.Kind.TRANSIENT));
    }

    @Test
    void errorsReportedInsideASuccessfulEnvelopeAreClassified() {
        runner.result = new ProcessRunner.ProcessResult(0, "{\"is_error\":true,\"result\":\"not logged in\"}", "");
        assertThatThrownBy(() -> codex.translate(request)).isInstanceOfSatisfying(TranslatorException.class,
                e -> assertThat(e.kind()).isEqualTo(TranslatorException.Kind.AUTH));
    }

    @Test
    void longErrorOutputIsAbbreviated() {
        runner.result = new ProcessRunner.ProcessResult(1, "x".repeat(2000), "");
        assertThatThrownBy(() -> codex.translate(request)).isInstanceOfSatisfying(TranslatorException.class,
                e -> assertThat(e.getMessage().length()).isLessThan(400));
    }
}
