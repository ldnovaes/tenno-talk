package com.tennotalk.translation;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import com.tennotalk.config.TennoProperties;

import static org.assertj.core.api.Assertions.assertThat;

/** Which providers exist (PLAN.md §28.1): one per key that is set, OpenAI first; none means the queue waits. */
class AiConfigurationTest {

    private static TennoProperties properties(String openaiKey, String anthropicKey) {
        var translation = new TennoProperties.Translation(false, 2, 3, 10, Duration.ofSeconds(5), Duration.ofMinutes(15));
        var ai = new TennoProperties.Ai(1000,
                new TennoProperties.Provider(openaiKey, "gpt-test", null),
                new TennoProperties.Provider(anthropicKey, "claude-test", null));
        return new TennoProperties("http://localhost", "2026-10-04", null, translation, ai, null, null);
    }

    @ParameterizedTest(name = "openai key [{0}], anthropic key [{1}] → {2}")
    @CsvSource(delimiter = '|', nullValues = "null", value = {
            "sk-1 | sk-2 | openai anthropic",
            "sk-1 | null | openai",
            "sk-1 | '  ' | openai",
            "null | sk-2 | anthropic",
            "''   | sk-2 | anthropic",
            "null | null | ''",
    })
    void oneProviderPerKeyInPriorityOrder(String openaiKey, String anthropicKey, String expected) {
        List<Translator> translators = new AiConfiguration().translators(properties(openaiKey, anthropicKey), Clock.systemUTC());
        List<String> ids = translators.stream().map(Translator::id).toList();
        assertThat(String.join(" ", ids)).isEqualTo(expected);
    }
}
