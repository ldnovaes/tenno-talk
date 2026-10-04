package com.tennotalk.realtime;

import com.tennotalk.chat.ChatEvents.*;
import com.tennotalk.chat.ChatRealtime;
import com.tennotalk.notifications.NotificationService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/** Single bounded batch, ordered by job id; lease survives process restart. */
@Component
public class RealtimeWorker {
    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final ChatRealtime chat;
    private final NotificationService notifications;
    private final com.tennotalk.push.PushDelivery push;
    public RealtimeWorker(JdbcClient jdbc, JsonMapper json, ChatRealtime chat, NotificationService notifications, com.tennotalk.push.PushDelivery push) {
        this.jdbc = jdbc; this.json = json; this.chat = chat; this.notifications = notifications; this.push = push;
    }
    record Job(long id, String kind, String payload) {}
    @Scheduled(fixedDelay = 150)
    public synchronized void run() {
        for (int i = 0; i < 50; i++) {
            var next = jdbc.sql("""
                UPDATE realtime_jobs SET available_at = now() + interval '2 minutes', attempts = attempts + 1
                WHERE id = (SELECT id FROM realtime_jobs WHERE available_at <= now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
                RETURNING id, kind, payload
                """).query((rs, row) -> new Job(rs.getLong("id"), rs.getString("kind"), rs.getString("payload"))).optional();
            if (next.isEmpty()) return;
            Job job = next.get();
            try {
                switch (job.kind()) {
                    case "MessageCreated" -> chat.onCreated(json.readValue(job.payload(), MessageCreated.class));
                    case "MessageUpdated" -> chat.onUpdated(json.readValue(job.payload(), MessageUpdated.class));
                    case "TranslationChanged" -> chat.onTranslation(json.readValue(job.payload(), TranslationChanged.class));
                    case "ReceiptChanged" -> chat.onReceipt(json.readValue(job.payload(), ReceiptChanged.class));
                    case "ReactionChanged" -> chat.onReaction(json.readValue(job.payload(), ReactionChanged.class));
                    case "Created" -> {
                        var event = json.readValue(job.payload(), NotificationService.Created.class);
                        notifications.push(event); push.enqueue(event.notificationId());
                    }
                    case "Read" -> notifications.pushRead(json.readValue(job.payload(), NotificationService.Read.class));
                    default -> throw new IllegalStateException("Unknown dispatch kind");
                }
                jdbc.sql("DELETE FROM realtime_jobs WHERE id = :id").param("id", job.id()).update();
            } catch (Exception error) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("Dispatch failed for job {} ({})", job.id(), job.kind());
                jdbc.sql("UPDATE realtime_jobs SET available_at = now() + make_interval(secs => LEAST(300, attempts * 5)) WHERE id = :id")
                    .param("id", job.id()).update();
            }
        }
    }
}
