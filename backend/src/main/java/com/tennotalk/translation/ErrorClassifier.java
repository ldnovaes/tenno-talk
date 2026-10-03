package com.tennotalk.translation;

import java.util.List;
import java.util.Locale;

/** Maps CLI error output to AUTH / QUOTA / TRANSIENT using configurable patterns. */
public class ErrorClassifier {

    private final List<String> authPatterns;
    private final List<String> quotaPatterns;

    public ErrorClassifier(List<String> authPatterns, List<String> quotaPatterns) {
        this.authPatterns = authPatterns.stream().map(p -> p.toLowerCase(Locale.ROOT)).toList();
        this.quotaPatterns = quotaPatterns.stream().map(p -> p.toLowerCase(Locale.ROOT)).toList();
    }

    public TranslatorException.Kind classify(String output) {
        String text = output == null ? "" : output.toLowerCase(Locale.ROOT);
        // Quota first: "429 Too Many Requests" must not be read as an auth problem.
        if (quotaPatterns.stream().anyMatch(text::contains)) return TranslatorException.Kind.QUOTA;
        if (authPatterns.stream().anyMatch(text::contains)) return TranslatorException.Kind.AUTH;
        return TranslatorException.Kind.TRANSIENT;
    }
}
