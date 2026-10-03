package com.tennotalk.common;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.UUID;

/** Opaque keyset cursor: (createdAt, id) encoded as URL-safe base64. */
public record Cursor(Instant createdAt, UUID id) {

    public String encode() {
        String raw = createdAt.toString() + "|" + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    public static Cursor decode(String value) {
        try {
            String raw = new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
            int separator = raw.indexOf('|');
            if (separator < 0) throw ApiException.validation("Invalid cursor.");
            return new Cursor(Instant.parse(raw.substring(0, separator)), UUID.fromString(raw.substring(separator + 1)));
        } catch (IllegalArgumentException | DateTimeParseException exception) {
            throw ApiException.validation("Invalid cursor.");
        }
    }

    public static Cursor decodeOrNull(String value) {
        return value == null || value.isBlank() ? null : decode(value);
    }
}
