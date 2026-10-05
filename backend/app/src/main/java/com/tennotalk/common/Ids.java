package com.tennotalk.common;

import java.util.UUID;

public final class Ids {

    private Ids() {}

    public static UUID newId() {
        return UUID.randomUUID();
    }

    public static UUID parse(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            throw ApiException.notFound("Not found.");
        }
    }
}
