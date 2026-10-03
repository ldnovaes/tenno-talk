package com.tennotalk.translation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class OutputParserTest {

    @Test
    void readsAPlainJsonAnswer() {
        var parsed = OutputParser.parse("{\"natural\": \"Anh nhớ em.\", \"literal\": \"Anh nhớ em (lit).\"}");
        assertThat(parsed).hasValueSatisfying(p -> {
            assertThat(p.natural()).isEqualTo("Anh nhớ em.");
            assertThat(p.literal()).isEqualTo("Anh nhớ em (lit).");
        });
    }

    @Test
    void findsTheAnswerInsideNoisyCliOutput() {
        String stdout = """
                codex v0.9
                [thinking] the user wants {a translation}
                ```json
                {"natural": "Saudade", "literal": "Lembrança"}
                ```
                tokens used: 120
                """;
        assertThat(OutputParser.parse(stdout)).hasValueSatisfying(p -> assertThat(p.natural()).isEqualTo("Saudade"));
    }

    @Test
    void unwrapsTheClaudeCodeEnvelope() {
        String stdout = "{\"type\":\"result\",\"is_error\":false,\"result\":\"{\\\"natural\\\":\\\"Oi\\\",\\\"literal\\\":\\\"Olá\\\"}\"}";
        assertThat(OutputParser.parse(stdout)).hasValueSatisfying(p -> assertThat(p.literal()).isEqualTo("Olá"));
        assertThat(OutputParser.envelopeError(stdout)).isEmpty();
    }

    @Test
    void reportsErrorsInsideTheEnvelope() {
        String stdout = "{\"type\":\"result\",\"is_error\":true,\"result\":\"Invalid API key · Please run /login\"}";
        assertThat(OutputParser.envelopeError(stdout)).hasValueSatisfying(e -> assertThat(e.message()).contains("/login"));
    }

    @Test
    void usesTheNaturalTranslationWhenLiteralIsMissing() {
        assertThat(OutputParser.parse("{\"natural\": \"Hi\"}")).hasValueSatisfying(p -> assertThat(p.literal()).isEqualTo("Hi"));
    }

    @Test
    void prefersTheLastAnswer() {
        String stdout = "{\"natural\": \"draft\"}\n{\"natural\": \"final\"}";
        assertThat(OutputParser.parse(stdout)).hasValueSatisfying(p -> assertThat(p.natural()).isEqualTo("final"));
    }

    @Test
    void keepsBracesInsideTheTranslatedText() {
        assertThat(OutputParser.parse("{\"natural\": \"Use {name} here\", \"literal\": \"x\"}"))
                .hasValueSatisfying(p -> assertThat(p.natural()).isEqualTo("Use {name} here"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "I can't help with that.", "{\"natural\": \"\"}", "{\"other\": 1}", "{broken json", "[1,2]"})
    void rejectsAnswersWithoutATranslation(String stdout) {
        assertThat(OutputParser.parse(stdout)).isEmpty();
    }

    @Test
    void nullOutputIsEmpty() {
        assertThat(OutputParser.parse(null)).isEmpty();
    }
}
