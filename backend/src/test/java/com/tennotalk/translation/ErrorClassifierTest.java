package com.tennotalk.translation;

import java.util.List;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class ErrorClassifierTest {

    private final ErrorClassifier classifier = new ErrorClassifier(
            List.of("not logged in", "login required", "unauthorized", "401", "authentication", "please run /login", "expired"),
            List.of("usage limit", "rate limit", "429", "quota", "too many requests"));

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "Error: Not logged in. Please run /login | AUTH",
        "401 Unauthorized | AUTH",
        "Your session has expired | AUTH",
        "You've hit your usage limit. Try again at 5pm | QUOTA",
        "429 Too Many Requests | QUOTA",
        "Rate limit reached for requests | QUOTA",
        "connection reset by peer | TRANSIENT",
        "'' | TRANSIENT",
    })
    void classifies(String output, TranslatorException.Kind expected) {
        assertThat(classifier.classify(output)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"429 Unauthorized-looking quota message | QUOTA"})
    void quotaWinsOverAuthWhenBothMatch(String output, TranslatorException.Kind expected) {
        assertThat(classifier.classify(output)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"NOT LOGGED IN | AUTH"})
    void ignoresCase(String output, TranslatorException.Kind expected) {
        assertThat(classifier.classify(output)).isEqualTo(expected);
    }
}
