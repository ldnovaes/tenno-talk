package com.tennotalk.realtime;

import java.time.Instant;
import java.util.UUID;

/** A user's first socket opened (online) or last socket closed (offline). */
public record PresenceChanged(UUID userId, boolean online, Instant at) {}
