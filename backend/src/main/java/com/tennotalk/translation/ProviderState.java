package com.tennotalk.translation;

import java.time.Instant;

/** State of one AI provider (PLAN.md §28.3). */
public record ProviderState(String provider, String state, Instant until, String lastError, Instant checkedAt) {

    public static final String OK = "ok";
    public static final String NEEDS_REAUTH = "needs_reauth";
    public static final String REAUTH_PENDING = "reauth_pending";
    public static final String COOLING_DOWN = "cooling_down";

    /** Cooling down ends by itself once {@code until} passes. */
    public boolean usable(Instant now) {
        return OK.equals(state) || (COOLING_DOWN.equals(state) && until != null && !until.isAfter(now));
    }
}
