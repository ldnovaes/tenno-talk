package com.tennotalk.translation;

import java.util.Optional;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Extracts {"natural", "literal"} from a CLI answer. Handles the Claude Code JSON
 * envelope ({"result": "..."}) and stray text or code fences around the object.
 */
public final class OutputParser {

    public record Parsed(String natural, String literal) {}

    /** Text of an error reported inside a successful envelope (Claude: is_error = true). */
    public record EnvelopeError(String message) {}

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private OutputParser() {}

    public static Optional<EnvelopeError> envelopeError(String stdout) {
        JsonNode envelope = tryParse(stdout.trim());
        if (envelope != null && envelope.path("is_error").asBoolean(false)) {
            return Optional.of(new EnvelopeError(envelope.path("result").asString("")));
        }
        return Optional.empty();
    }

    public static Optional<Parsed> parse(String stdout) {
        String text = stdout == null ? "" : stdout.trim();
        JsonNode envelope = tryParse(text);
        if (envelope != null && envelope.has("result") && envelope.get("result").isString()) {
            text = envelope.get("result").asString();
        } else if (envelope != null && envelope.has("natural")) {
            return toParsed(envelope);
        }
        // Scan every {...} candidate from the end (the final answer usually comes last).
        for (int end = text.lastIndexOf('}'); end >= 0; end = text.lastIndexOf('}', end - 1)) {
            for (int start = text.lastIndexOf('{', end); start >= 0; start = text.lastIndexOf('{', start - 1)) {
                JsonNode node = tryParse(text.substring(start, end + 1));
                if (node != null && node.has("natural")) return toParsed(node);
            }
        }
        return Optional.empty();
    }

    private static Optional<Parsed> toParsed(JsonNode node) {
        String natural = node.path("natural").asString("").trim();
        if (natural.isEmpty()) return Optional.empty();
        String literal = node.path("literal").asString("").trim();
        return Optional.of(new Parsed(natural, literal.isEmpty() ? natural : literal));
    }

    private static JsonNode tryParse(String candidate) {
        if (candidate.isEmpty() || candidate.charAt(0) != '{') return null;
        try {
            JsonNode node = JSON.readTree(candidate);
            return node != null && node.isObject() ? node : null;
        } catch (JacksonException exception) {
            return null;
        }
    }
}
