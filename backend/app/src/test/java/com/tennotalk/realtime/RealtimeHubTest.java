package com.tennotalk.realtime;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Sockets per user under concurrency: tabs open and close at the same time (reload, reconnect storms). */
class RealtimeHubTest {

    private static final AtomicInteger IDS = new AtomicInteger();

    private final List<PresenceChanged> presence = new CopyOnWriteArrayList<>();
    private final RealtimeHub hub = new RealtimeHub(JsonMapper.builder().build(), event -> {
        if (event instanceof PresenceChanged changed) presence.add(changed);
    }, Clock.systemUTC());

    /** A socket that counts what it receives. */
    private static WebSocketSession socket(AtomicInteger received) throws Exception {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("s" + IDS.incrementAndGet());
        when(session.isOpen()).thenReturn(true);
        doAnswer(invocation -> {
            received.incrementAndGet();
            return null;
        }).when(session).sendMessage(any(TextMessage.class));
        return session;
    }

    @Test
    void onlineFromTheFirstTabUntilTheLastOneCloses() throws Exception {
        UUID user = UUID.randomUUID();
        WebSocketSession a = hub.register(user, socket(new AtomicInteger()));
        WebSocketSession b = hub.register(user, socket(new AtomicInteger()));
        hub.unregister(user, a);
        assertThat(hub.isOnline(user)).isTrue();
        hub.unregister(user, b);
        assertThat(hub.isOnline(user)).isFalse();
        assertThat(presence).extracting(PresenceChanged::online).containsExactly(true, false);
    }

    @Test
    void everyOpenTabGetsEachEvent() throws Exception {
        UUID user = UUID.randomUUID();
        AtomicInteger phone = new AtomicInteger(), laptop = new AtomicInteger();
        hub.register(user, socket(phone));
        hub.register(user, socket(laptop));
        assertThat(hub.send(user, "typing.started", java.util.Map.of())).isTrue();
        assertThat(phone).hasValue(1);
        assertThat(laptop).hasValue(1);
        assertThat(hub.send(UUID.randomUUID(), "x", java.util.Map.of())).as("nobody connected").isFalse();
    }

    /**
     * One tab stays; others connect and disconnect from many threads at once. The tab that stays must keep
     * receiving events, the user must stay online, and presence must never say "offline" while it is open.
     */
    @RepeatedTest(20)
    void aTabThatStaysIsNeverLostWhileOthersComeAndGo() throws Exception {
        UUID user = UUID.randomUUID();
        AtomicInteger stays = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch start = new CountDownLatch(1);
        List<Throwable> errors = new CopyOnWriteArrayList<>();
        WebSocketSession first = socket(new AtomicInteger());
        WebSocketSession firstRegistered = hub.register(user, first);
        List<Runnable> work = new ArrayList<>();
        // Thread 0: the first tab closes while the staying tab opens (a reload).
        work.add(() -> hub.unregister(user, firstRegistered));
        work.add(() -> {
            try {
                hub.register(user, socket(stays));
            } catch (Exception e) {
                errors.add(e);
            }
        });
        for (int n = 0; n < 6; n++) {
            work.add(() -> {
                try {
                    for (int i = 0; i < 200; i++) {
                        WebSocketSession other = hub.register(user, socket(new AtomicInteger()));
                        hub.unregister(user, other);
                    }
                } catch (Throwable e) {
                    errors.add(e);
                }
            });
        }
        for (Runnable job : work) pool.submit(() -> {
            try {
                start.await();
                job.run();
            } catch (Throwable e) {
                errors.add(e);
            }
        });
        start.countDown();
        pool.shutdown();
        assertThat(pool.awaitTermination(30, TimeUnit.SECONDS)).isTrue();

        assertThat(errors).isEmpty();
        assertThat(hub.isOnline(user)).as("the staying tab keeps the user online").isTrue();
        hub.send(user, "message.created", java.util.Map.of());
        assertThat(stays).as("the staying tab still receives events").hasValue(1);
        assertThat(presence.getLast().online()).as("last presence event while a tab is open").isTrue();
    }
}
