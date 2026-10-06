package com.tennotalk.realtime;

import java.io.IOException;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;

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
    /** Sockets per user (tabs and devices); a new one beyond this closes the oldest (PLAN.md §38). */
    static final int MAX_SOCKETS_PER_USER = 10;
    private static final String CONNECTED_AT = "tenno.connectedAt";

    private final Map<UUID, Set<WebSocketSession>> sessions = new ConcurrentHashMap<>();
    /**
     * A tab connecting while another of the same user disconnects (a reload) must neither lose the new socket nor
     * announce "offline" after it. Changing a user's sockets and announcing the change happen under that user's lock
     * (striped: bounded memory, unrelated users rarely wait for each other).
     */
    private final Object[] locks = new Object[64];

    {
        for (int i = 0; i < locks.length; i++) locks[i] = new Object();
    }

    private Object lockOf(UUID userId) {
        return locks[Math.floorMod(userId.hashCode(), locks.length)];
    }
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
        raw.getAttributes().put(CONNECTED_AT, System.nanoTime());
        List<WebSocketSession> surplus;
        synchronized (lockOf(userId)) {
            Set<WebSocketSession> set = sessions.computeIfAbsent(userId, id -> ConcurrentHashMap.newKeySet());
            boolean first = set.isEmpty();
            set.add(session);
            if (first) events.publishEvent(new PresenceChanged(userId, true, clock.instant()));
            surplus = set.stream()
                    .sorted(Comparator.comparingLong(RealtimeHub::connectedAt).reversed())
                    .skip(MAX_SOCKETS_PER_USER)
                    .toList();
        }
        surplus.forEach(old -> close(old, CloseStatus.POLICY_VIOLATION));
        return session;
    }

    /** Sign-out: the sockets opened with that HTTP session end. */
    public void closeHttpSession(UUID userId, String httpSessionId) {
        closeWhere(userId, id -> httpSessionId.equals(id));
    }

    /** Password change or account deletion: the sockets of every other HTTP session end ({@code keep} null: all). */
    public void closeOtherHttpSessions(UUID userId, String keep) {
        closeWhere(userId, id -> keep == null || !keep.equals(id));
    }

    private void closeWhere(UUID userId, java.util.function.Predicate<String> httpSession) {
        Set<WebSocketSession> set = sessions.get(userId);
        if (set == null) return;
        List.copyOf(set).stream()
                .filter(session -> httpSession.test(httpSessionOf(session)))
                .forEach(session -> close(session, CloseStatus.SESSION_NOT_RELIABLE));
    }

    private static String httpSessionOf(WebSocketSession session) {
        return session.getAttributes().get(HttpSessionHandshakeInterceptor.HTTP_SESSION_ID_ATTR_NAME) instanceof String id ? id : null;
    }

    private static long connectedAt(WebSocketSession session) {
        return session.getAttributes().get(CONNECTED_AT) instanceof Long at ? at : 0L;
    }

    private void close(WebSocketSession session, CloseStatus status) {
        try {
            session.close(status);
        } catch (IOException | IllegalStateException closed) {
            log.debug("Socket {} was already closed", session.getId(), closed);
        }
    }

    public void unregister(UUID userId, WebSocketSession session) {
        synchronized (lockOf(userId)) {
            Set<WebSocketSession> set = sessions.get(userId);
            if (set == null) return;
            set.removeIf(item -> item == session || item.getId().equals(session.getId()));
            if (set.isEmpty()) {
                sessions.remove(userId);
                events.publishEvent(new PresenceChanged(userId, false, clock.instant()));
            }
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
