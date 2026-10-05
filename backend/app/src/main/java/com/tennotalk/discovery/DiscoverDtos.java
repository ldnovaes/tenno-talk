package com.tennotalk.discovery;

import java.time.Instant;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request bodies of the discover endpoints. */
public final class DiscoverDtos {

    private DiscoverDtos() {}

    /**
     * One thing the client saw or did. Kinds accepted from clients: impression, dwell, share, profile_open,
     * hide_post, hide_author (likes, comments, follows and reports are recorded by the services themselves).
     *
     * @param clientId idempotency key, unique per user
     * @param value    visible milliseconds for "dwell"
     * @param at       when it happened on the device (clamped to the last day)
     */
    public record EventInput(@Size(max = 100) String clientId, @Size(max = 64) String postId, @Size(max = 32) String kind,
            Long value, Instant at) {}

    public record EventBatch(@NotNull @Size(max = 100) List<@Valid EventInput> events) {}
}
