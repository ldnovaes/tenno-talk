package com.tennotalk.translation;

import java.time.Instant;

/** Why a provider could not translate: drives the fallback rules of PLAN.md §28.3. */
public class TranslatorException extends Exception {

    public enum Kind {
        /** Login expired or invalid: needs re-authentication. */
        AUTH,
        /** Plan usage limit reached: cool down until reset. */
        QUOTA,
        /** Timeout, network, invalid output: retry. */
        TRANSIENT
    }

    private final Kind kind;
    private final transient Instant retryAt;

    public TranslatorException(Kind kind, String message) {
        this(kind, message, null);
    }

    public TranslatorException(Kind kind, String message, Instant retryAt) {
        super(message);
        this.kind = kind;
        this.retryAt = retryAt;
    }

    public Kind kind() {
        return kind;
    }

    public Instant retryAt() {
        return retryAt;
    }
}
