package com.tennotalk.realtime;

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
    public TypingSessions(ApplicationEventPublisher events, ChatRepository chat) {
        this.events = events;
        this.chat = chat;
    }
    public synchronized void update(String session, UUID user, UUID conversation, boolean typing) {
        if (!chat.isMember(conversation, user)) return;
        Key key = new Key(user, conversation);
        if (typing) {
            active.computeIfAbsent(key, ignored -> new HashMap<>()).put(session, System.currentTimeMillis() + 6000);
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
        long now = System.currentTimeMillis();
        active.entrySet().removeIf(entry -> {
            entry.getValue().values().removeIf(until -> until <= now);
            if (!entry.getValue().isEmpty()) return false;
            events.publishEvent(new TypingReceived(entry.getKey().user(), entry.getKey().conversation(), false));
            return true;
        });
    }
}
