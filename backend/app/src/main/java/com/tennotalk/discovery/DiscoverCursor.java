package com.tennotalk.discovery;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.UUID;

import com.tennotalk.common.ApiException;

/** Opaque position in a ranked session: (session id, offset) as URL-safe base64. */
record DiscoverCursor(UUID session, int offset) {

    DiscoverCursor {
        offset = Math.max(0, offset);
    }

    String encode() {
        String raw = session + ":" + offset;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    static DiscoverCursor decodeOrNull(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            String raw = new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
            int separator = raw.indexOf(':');
            if (separator < 0) throw ApiException.validation("Invalid cursor.");
            return new DiscoverCursor(UUID.fromString(raw.substring(0, separator)), Integer.parseInt(raw.substring(separator + 1)));
        } catch (IllegalArgumentException malformed) {
            throw ApiException.validation("Invalid cursor.");
        }
    }
}
