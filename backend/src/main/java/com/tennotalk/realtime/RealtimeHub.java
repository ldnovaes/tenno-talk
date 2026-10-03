package com.tennotalk.realtime;

import java.io.IOException;
import java.time.Clock;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import com.tennotalk.common.Presence;

import tools.jackson.databind.json.JsonMapper;

/**
 * Open sockets per user (single instance; Redis pub/sub if it ever scales out, PLAN.md §26).
 * Envelope: {"type": "message.created", "payload": {...}} — the frontend RealtimeEventMap.
 */
@Component
public class RealtimeHub implements Presence {

    private static final Logger log = LoggerFactory.getLogger(RealtimeHub.class);
    private static final int SEND_TIME_LIMIT_MS = 10_000;
    private static final int BUFFER_LIMIT_BYTES = 512 * 1024;

    private final Map<UUID, Set<WebSocketSession>> sessions = new ConcurrentHashMap<>();
    private final JsonMapper json;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public RealtimeHub(JsonMapper json, ApplicationEventPublisher events, Clock clock) {
        this.json = json;
        this.events = events;
        this.clock = clock;
    }

    public WebSocketSession register(UUID userId, WebSocketSession raw) {
        WebSocketSession session = new ConcurrentWebSocketSessionDecorator(raw, SEND_TIME_LIMIT_MS, BUFFER_LIMIT_BYTES);
        boolean first = sessions.computeIfAbsent(userId, id -> ConcurrentHashMap.newKeySet()).isEmpty();
        sessions.get(userId).add(session);
        if (first) events.publishEvent(new PresenceChanged(userId, true, clock.instant()));
        return session;
    }

    public void unregister(UUID userId, WebSocketSession session) {
        Set<WebSocketSession> set = sessions.get(userId);
        if (set == null) return;
        set.removeIf(item -> item == session || item.getId().equals(session.getId()));
        if (set.isEmpty()) {
            sessions.remove(userId);
            events.publishEvent(new PresenceChanged(userId, false, clock.instant()));
        }
    }

    @Override
    public boolean isOnline(UUID userId) {
        Set<WebSocketSession> set = sessions.get(userId);
        return set != null && !set.isEmpty();
    }

    /** Sends an event to every socket of a user. Returns true if at least one socket got it. */
    public boolean send(UUID userId, String type, Object payload) {
        Set<WebSocketSession> set = sessions.get(userId);
        if (set == null || set.isEmpty()) return false;
        String text = json.writeValueAsString(Map.of("type", type, "payload", payload));
        boolean delivered = false;
        for (WebSocketSession session : set) {
            try {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(text));
                    delivered = true;
                }
            } catch (IOException | IllegalStateException exception) {
                log.debug("Dropping socket {} of {}", session.getId(), userId, exception);
            }
        }
        return delivered;
    }
}
