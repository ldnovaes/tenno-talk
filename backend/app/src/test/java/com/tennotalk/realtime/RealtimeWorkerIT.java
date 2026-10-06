package com.tennotalk.realtime;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionTemplate;

import com.tennotalk.notifications.NotificationService;
import com.tennotalk.support.IntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Durable dispatch (PLANO_UX.md §3.3): jobs written with the change, a bounded batch per run, failures retried
 * later without holding the others, a claim (lease) that survives a crash, nothing left by a rolled-back change.
 * The scheduled worker also runs in tests, so each test holds the worker's monitor while it checks.
 */
class RealtimeWorkerIT extends IntegrationTest {

    @Autowired
    RealtimeWorker worker;

    @Autowired
    ApplicationEventPublisher events;

    @Autowired
    TransactionTemplate tx;

    private void job(String kind, String payload) {
        jdbc.sql("INSERT INTO realtime_jobs (kind, payload) VALUES (:k, :p)").param("k", kind).param("p", payload).update();
    }

    private String readJob() {
        return "{\"recipientId\":\"" + UUID.randomUUID() + "\"}";
    }

    private long jobs() {
        return jdbc.sql("SELECT count(*) FROM realtime_jobs").query(Long.class).single();
    }

    @Test
    void oneRunDispatchesAtMostFiftyJobs() {
        synchronized (worker) {
            for (int n = 0; n < 60; n++) job("Read", readJob());
            worker.run();
            assertThat(jobs()).isEqualTo(10);
            worker.run();
            assertThat(jobs()).isZero();
        }
    }

    @Test
    void aFailingJobIsRetriedLaterAndDoesNotHoldTheOthers() {
        synchronized (worker) {
            job("SomethingUnknown", "{}");
            job("Read", readJob());
            worker.run();
            var failed = jdbc.sql("SELECT attempts, available_at > now() AS later FROM realtime_jobs")
                    .query((rs, i) -> rs.getInt("attempts") + "/" + rs.getBoolean("later")).single();
            assertThat(failed).as("one attempt, back later").isEqualTo("1/true");
            assertThat(jobs()).as("the job after it was dispatched").isOne();
        }
    }

    @Test
    void aJobThatKeepsFailingIsDroppedAfterItsLastAttempt() {
        synchronized (worker) {
            job("SomethingUnknown", "{}");
            jdbc.sql("UPDATE realtime_jobs SET attempts = :a").param("a", RealtimeWorker.MAX_ATTEMPTS - 2).update();
            worker.run();
            assertThat(jobs()).as("one attempt left").isOne();
            jdbc.sql("UPDATE realtime_jobs SET available_at = now() - interval '1 second'").update();
            worker.run();
            assertThat(jobs()).isZero();
        }
    }

    @Test
    void aJobClaimedByACrashedRunWaitsForItsLeaseThenRunsAgain() {
        synchronized (worker) {
            job("Read", readJob());
            jdbc.sql("UPDATE realtime_jobs SET available_at = now() + interval '2 minutes', attempts = 1").update();
            worker.run();
            assertThat(jobs()).as("still leased").isOne();

            jdbc.sql("UPDATE realtime_jobs SET available_at = now() - interval '1 second'").update();
            worker.run();
            assertThat(jobs()).isZero();
        }
    }

    @Test
    void aChangeThatRollsBackLeavesNoJob() {
        synchronized (worker) {
            tx.executeWithoutResult(status -> {
                events.publishEvent(new NotificationService.Read(UUID.randomUUID()));
                status.setRollbackOnly();
            });
            assertThat(jobs()).isZero();
            tx.executeWithoutResult(status -> events.publishEvent(new NotificationService.Read(UUID.randomUUID())));
            assertThat(jobs()).as("committed: one job").isOne();
        }
    }
}
