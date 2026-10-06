package com.tennotalk.realtime;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import com.tennotalk.chat.ChatRepository;

/** Ephemeral leases: one idle tab must not stop another tab that is still typing. */
@Component
public class TypingSessions {
    private record Key(UUID user, UUID conversation) {}
    private final Map<Key, Map<String, Long>> active = new HashMap<>();
    private final ApplicationEventPublisher events;
    private final ChatRepository chat;
    private final Clock clock;
    /** A typing indicator lasts this long without a renewal (the client renews every 3 s, PLANO_UX.md §10.3). */
    static final long LEASE_MS = 6000;
    public TypingSessions(ApplicationEventPublisher events, ChatRepository chat, Clock clock) {
        this.events = events;
        this.chat = chat;
        this.clock = clock;
    }
    public synchronized void update(String session, UUID user, UUID conversation, boolean typing) {
        if (!chat.isMember(conversation, user)) return;
        Key key = new Key(user, conversation);
        if (typing) {
            active.computeIfAbsent(key, ignored -> new HashMap<>()).put(session, clock.millis() + LEASE_MS);
            events.publishEvent(new TypingReceived(user, conversation, true));
        } else {
            var sessions = active.get(key);
            if (sessions == null) return;
            sessions.remove(session);
            expire();
        }
    }
    public synchronized void close(String session) {
        active.values().forEach(sessions -> sessions.remove(session));
        expire();
    }
    @Scheduled(fixedDelay = 1000)
    public synchronized void expire() {
        long now = clock.millis();
        active.entrySet().removeIf(entry -> {
            entry.getValue().values().removeIf(until -> until <= now);
            if (!entry.getValue().isEmpty()) return false;
            events.publishEvent(new TypingReceived(entry.getKey().user(), entry.getKey().conversation(), false));
            return true;
        });
    }
}
