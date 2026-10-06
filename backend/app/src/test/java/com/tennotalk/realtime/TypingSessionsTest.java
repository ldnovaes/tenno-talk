package com.tennotalk.realtime;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.Test;

import com.tennotalk.chat.ChatRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Typing leases per tab (PLANO_UX.md §10.3): one tab stopping never stops another that is still typing. */
class TypingSessionsTest {

    private final UUID user = UUID.randomUUID();
    private final UUID conversation = UUID.randomUUID();
    private final List<Boolean> events = new CopyOnWriteArrayList<>();
    private Instant now = Instant.parse("2026-10-05T12:00:00Z");
    private final Clock clock = new Clock() {
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    };
    private final ChatRepository chat = mock(ChatRepository.class);
    private final TypingSessions typing;

    TypingSessionsTest() {
        when(chat.isMember(any(), any())).thenReturn(true);
        typing = new TypingSessions(event -> {
            if (event instanceof TypingReceived received) events.add(received.typing());
        }, chat, clock);
    }

    private void advance(long millis) {
        now = now.plusMillis(millis);
        typing.expire();
    }

    @Test
    void startsAtOnceAndStopsWhenTheOnlyTabStops() {
        typing.update("tab-a", user, conversation, true);
        typing.update("tab-a", user, conversation, false);
        assertThat(events).containsExactly(true, false);
    }

    @Test
    void oneTabStoppingDoesNotStopAnotherStillTyping() {
        typing.update("tab-a", user, conversation, true);
        typing.update("tab-b", user, conversation, true);
        typing.update("tab-a", user, conversation, false);
        assertThat(events).containsExactly(true, true);
        typing.update("tab-b", user, conversation, false);
        assertThat(events).containsExactly(true, true, false);
    }

    @Test
    void closingATabEndsOnlyItsLease() {
        typing.update("tab-a", user, conversation, true);
        typing.update("tab-b", user, conversation, true);
        typing.close("tab-a");
        assertThat(events).doesNotContain(false);
        typing.close("tab-b");
        assertThat(events).endsWith(false);
    }

    @Test
    void aLostStopExpiresAfterTheLease() {
        typing.update("tab-a", user, conversation, true);
        advance(TypingSessions.LEASE_MS - 1);
        assertThat(events).containsExactly(true);
        advance(1);
        assertThat(events).containsExactly(true, false);
    }

    @Test
    void aRenewalKeepsItGoingPastTheFirstLease() {
        typing.update("tab-a", user, conversation, true);
        advance(3000);
        typing.update("tab-a", user, conversation, true);
        advance(4000);
        assertThat(events).doesNotContain(false);
        advance(2000);
        assertThat(events).endsWith(false);
    }

    @Test
    void aStopWithoutAStartIsIgnored() {
        typing.update("tab-a", user, conversation, false);
        typing.close("tab-z");
        assertThat(events).isEmpty();
    }

    @Test
    void onlyMembersCanType() {
        when(chat.isMember(conversation, user)).thenReturn(false);
        typing.update("tab-a", user, conversation, true);
        assertThat(events).isEmpty();
    }

    @Test
    void conversationsAreIndependent() {
        UUID other = UUID.randomUUID();
        typing.update("tab-a", user, conversation, true);
        typing.update("tab-a", user, other, true);
        typing.update("tab-a", user, other, false);
        assertThat(events).containsExactly(true, true, false);
        advance(TypingSessions.LEASE_MS);
        assertThat(events).containsExactly(true, true, false, false);
    }
}
