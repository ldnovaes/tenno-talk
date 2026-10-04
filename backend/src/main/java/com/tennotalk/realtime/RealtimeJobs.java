package com.tennotalk.realtime;

import com.tennotalk.chat.ChatEvents.*;
import com.tennotalk.notifications.NotificationService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import tools.jackson.databind.json.JsonMapper;

/** Durable intent is inserted in the originating transaction; no sockets on the HTTP thread. */
@Component
public class RealtimeJobs {
    private final JdbcClient jdbc;
    private final JsonMapper json;
    public RealtimeJobs(JdbcClient jdbc, JsonMapper json) { this.jdbc = jdbc; this.json = json; }
    private void add(Object event) {
        jdbc.sql("INSERT INTO realtime_jobs(kind, payload) VALUES (:kind, :payload)")
            .param("kind", event.getClass().getSimpleName()).param("payload", json.writeValueAsString(event)).update();
    }
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT) public void created(MessageCreated e) { add(e); }
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT) public void updated(MessageUpdated e) { add(e); }
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT) public void translated(TranslationChanged e) { add(e); }
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT) public void receipt(ReceiptChanged e) { add(e); }
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT) public void reaction(ReactionChanged e) { add(e); }
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT) public void notification(NotificationService.Created e) { add(e); }
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT) public void read(NotificationService.Read e) { add(e); }
}
