package com.tennotalk.common;

import java.util.UUID;

/** Live presence, provided by the realtime module (open WebSocket = online). */
public interface Presence {
    boolean isOnline(UUID userId);
}
