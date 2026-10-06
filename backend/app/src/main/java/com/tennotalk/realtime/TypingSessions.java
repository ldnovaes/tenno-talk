package com.tennotalk.realtime;

import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import com.tennotalk.chat.ChatRepository;

/**
 * Ephemeral leases: one idle tab must not stop another tab that is still typing. Only the state is guarded by the
 * lock; the membership check and the fan-out (database reads, sockets) run outside it, so one client sending typing
 * frames as fast as it can never slows anyone else down (PLAN.md §38).
 */
@Component
public class TypingSessions {
    private record Key(UUID user, UUID conversation) {}
    private final Map<Key, Map<String, Long>> active = new HashMap<>();
    /** When "typing" was last announced for a key: renewals closer than {@link #ANNOUNCE_EVERY_MS} are not repeated. */
    private final Map<Key, Long> announced = new HashMap<>();
    private final ApplicationEventPublisher events;
    private final ChatRepository chat;
    private final Clock clock;
    /** A typing indicator lasts this long without a renewal (the client renews every 3 s, PLANO_UX.md §10.3). */
    static final long LEASE_MS = 6000;
    /** Below the client's renewal (3 s) and well within the receiver's 6 s timeout. */
    static final long ANNOUNCE_EVERY_MS = 2500;
    public TypingSessions(ApplicationEventPublisher events, ChatRepository chat, Clock clock) {
        this.events = events;
        this.chat = chat;
        this.clock = clock;
    }
    public void update(String session, UUID user, UUID conversation, boolean typing) {
        if (!chat.isMember(conversation, user)) return;
        Key key = new Key(user, conversation);
        boolean announce = false;
        List<Key> ended = List.of();
        synchronized (this) {
            long now = clock.millis();
            if (typing) {
                active.computeIfAbsent(key, ignored -> new HashMap<>()).put(session, now + LEASE_MS);
                Long last = announced.get(key);
                announce = last == null || now - last >= ANNOUNCE_EVERY_MS;
                if (announce) announced.put(key, now);
            } else {
                var sessions = active.get(key);
                if (sessions == null) return;
                sessions.remove(session);
                ended = expired(now);
            }
        }
        if (announce) events.publishEvent(new TypingReceived(user, conversation, true));
        stopped(ended);
    }
    public void close(String session) {
        List<Key> ended;
        synchronized (this) {
            active.values().forEach(sessions -> sessions.remove(session));
            ended = expired(clock.millis());
        }
        stopped(ended);
    }
    @Scheduled(fixedDelay = 1000)
    public void expire() {
        List<Key> ended;
        synchronized (this) {
            ended = expired(clock.millis());
        }
        stopped(ended);
    }
    private List<Key> expired(long now) {
        List<Key> ended = new ArrayList<>();
        active.entrySet().removeIf(entry -> {
            entry.getValue().values().removeIf(until -> until <= now);
            if (!entry.getValue().isEmpty()) return false;
            ended.add(entry.getKey());
            announced.remove(entry.getKey());
            return true;
        });
        return ended;
    }
    private void stopped(List<Key> ended) {
        ended.forEach(key -> events.publishEvent(new TypingReceived(key.user(), key.conversation(), false)));
    }
}
