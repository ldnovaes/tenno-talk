package com.tennotalk.translation;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Translation queue in a table, claimed with FOR UPDATE SKIP LOCKED (PLAN.md §28.2). */
@Repository
public class TranslationJobRepository {

    public record Job(long id, String kind, UUID refId, String targetLanguage, int attempts) {}

    private final JdbcClient jdbc;

    public TranslationJobRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Adds a job, or puts an existing one back in the queue (manual retry). */
    public void enqueue(String kind, UUID refId, String language, Instant runAfter, boolean resetAttempts) {
        jdbc.sql("""
                INSERT INTO translation_jobs (kind, ref_id, target_language, run_after) VALUES (:k, :r, :l, :at)
                ON CONFLICT (kind, ref_id, target_language) DO UPDATE SET status = 'pending', run_after = :at,
                    locked_at = NULL, attempts = CASE WHEN :reset THEN 0 ELSE translation_jobs.attempts END
                """)
                .param("k", kind)
                .param("r", refId)
                .param("l", language)
                .param("at", Timestamp.from(runAfter))
                .param("reset", resetAttempts)
                .update();
    }

    public List<Job> claim(int limit, Instant now) {
        return jdbc.sql("""
                UPDATE translation_jobs SET status = 'running', locked_at = :now
                WHERE id IN (SELECT id FROM translation_jobs WHERE status = 'pending' AND run_after <= :now
                             ORDER BY id FOR UPDATE SKIP LOCKED LIMIT :limit)
                RETURNING id, kind, ref_id, target_language, attempts
                """)
                .param("now", Timestamp.from(now))
                .param("limit", limit)
                .query((rs, row) -> new Job(rs.getLong("id"), rs.getString("kind"), rs.getObject("ref_id", UUID.class),
                        rs.getString("target_language"), rs.getInt("attempts")))
                .list();
    }

    public void done(long id) {
        jdbc.sql("UPDATE translation_jobs SET status = 'done', locked_at = NULL WHERE id = :id").param("id", id).update();
    }

    /** No provider available: wait without burning an attempt (PLAN.md §28.3). */
    public void waitForProvider(long id, String error) {
        jdbc.sql("UPDATE translation_jobs SET status = 'waiting_provider', locked_at = NULL, last_error = :e WHERE id = :id")
                .param("e", error)
                .param("id", id)
                .update();
    }

    public void retryLater(long id, Instant runAfter, String error) {
        jdbc.sql("""
                UPDATE translation_jobs SET status = 'pending', attempts = attempts + 1, run_after = :at, locked_at = NULL, last_error = :e
                WHERE id = :id
                """)
                .param("at", Timestamp.from(runAfter))
                .param("e", error)
                .param("id", id)
                .update();
    }

    public void fail(long id, String error) {
        jdbc.sql("UPDATE translation_jobs SET status = 'failed', attempts = attempts + 1, locked_at = NULL, last_error = :e WHERE id = :id")
                .param("e", error)
                .param("id", id)
                .update();
    }

    /** Wakes up every waiting job (a provider came back). */
    public int resumeWaiting(Instant now) {
        return jdbc.sql("UPDATE translation_jobs SET status = 'pending', run_after = :now WHERE status = 'waiting_provider'")
                .param("now", Timestamp.from(now))
                .update();
    }

    /** Jobs stuck in "running" (worker crashed) go back to the queue. */
    public int releaseStale(Instant olderThan) {
        return jdbc.sql("UPDATE translation_jobs SET status = 'pending', locked_at = NULL WHERE status = 'running' AND locked_at < :t")
                .param("t", Timestamp.from(olderThan))
                .update();
    }

    public Map<String, Long> countsByStatus() {
        Map<String, Long> counts = new java.util.LinkedHashMap<>();
        for (String status : List.of("pending", "running", "waiting_provider", "failed")) counts.put(status, 0L);
        jdbc.sql("SELECT status, count(*) AS n FROM translation_jobs WHERE status <> 'done' GROUP BY status")
                .query((rs, row) -> {
                    counts.put(rs.getString("status"), rs.getLong("n"));
                    return null;
                })
                .list();
        return counts;
    }
}
