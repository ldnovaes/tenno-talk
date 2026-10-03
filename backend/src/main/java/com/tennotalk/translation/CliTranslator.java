package com.tennotalk.translation;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeoutException;

import com.tennotalk.config.TennoProperties;

/**
 * Translates through an AI CLI logged in with a subscription plan (PLAN.md §28.1):
 * {@code codex exec} (ChatGPT) or {@code claude -p} (Claude).
 */
public class CliTranslator implements Translator {

    private final TennoProperties.Provider provider;
    private final ProcessRunner runner;
    private final ErrorClassifier classifier;
    private final Duration timeout;

    public CliTranslator(TennoProperties.Provider provider, ProcessRunner runner, ErrorClassifier classifier, Duration timeout) {
        this.provider = provider;
        this.runner = runner;
        this.classifier = classifier;
        this.timeout = timeout;
    }

    @Override
    public String id() {
        return provider.id();
    }

    static List<String> command(List<String> template, String prompt) {
        return template.stream().map(part -> part.replace("{prompt}", prompt)).toList();
    }

    @Override
    public TranslationResult translate(TranslationRequest request) throws TranslatorException {
        ProcessRunner.ProcessResult result;
        try {
            result = runner.run(command(provider.command(), PromptBuilder.build(request)), timeout);
        } catch (TimeoutException exception) {
            throw new TranslatorException(TranslatorException.Kind.TRANSIENT, provider.id() + " timed out");
        } catch (IOException exception) {
            // Missing binary or I/O failure: the next provider can still work.
            throw new TranslatorException(TranslatorException.Kind.TRANSIENT, provider.id() + ": " + exception.getMessage());
        }
        if (result.exitCode() != 0) {
            String output = result.stderr() + "\n" + result.stdout();
            throw new TranslatorException(classifier.classify(output), provider.id() + " failed: " + abbreviate(output));
        }
        var envelopeError = OutputParser.envelopeError(result.stdout());
        if (envelopeError.isPresent()) {
            String message = envelopeError.get().message();
            throw new TranslatorException(classifier.classify(message), provider.id() + " failed: " + abbreviate(message));
        }
        return OutputParser.parse(result.stdout())
                .map(parsed -> new TranslationResult(parsed.natural(), parsed.literal(), provider.id()))
                .orElseThrow(() -> new TranslatorException(TranslatorException.Kind.TRANSIENT,
                        provider.id() + " returned an invalid answer"));
    }

    private static String abbreviate(String text) {
        String flat = text.replaceAll("\\s+", " ").trim();
        return flat.length() > 300 ? flat.substring(0, 300) + "…" : flat;
    }
}
