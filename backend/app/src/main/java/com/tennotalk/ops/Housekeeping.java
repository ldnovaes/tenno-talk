package com.tennotalk.ops;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.tennotalk.media.MediaService;

/**
 * Retention (PLAN.md §38): unused files, finished background jobs and old read notifications would otherwise grow
 * forever on a shared VPS. Each step is a short statement of its own; a failure is logged and retried next hour.
 */
@Component
public class Housekeeping {

    private static final Logger log = LoggerFactory.getLogger(Housekeeping.class);
    static final Duration JOBS_KEPT = Duration.ofDays(7);
    static final Duration READ_NOTIFICATIONS_KEPT = Duration.ofDays(90);

    private final JdbcClient jdbc;
    private final MediaService media;
    private final Clock clock;

    public Housekeeping(JdbcClient jdbc, MediaService media, Clock clock) {
        this.jdbc = jdbc;
        this.media = media;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "PT1H", initialDelayString = "PT10M")
    public void run() {
        try {
            runOnce();
        } catch (RuntimeException failure) {
            log.warn("Housekeeping failed; trying again in an hour", failure);
        }
    }

    public void runOnce() {
        Instant now = clock.instant();
        int files = media.deleteUnused();
        Timestamp jobsBefore = Timestamp.from(now.minus(JOBS_KEPT));
        int translations = jdbc.sql("DELETE FROM translation_jobs WHERE status IN ('done', 'failed') AND created_at < :before")
                .param("before", jobsBefore).update();
        int classifications = jdbc.sql("DELETE FROM classification_jobs WHERE status IN ('done', 'failed') AND created_at < :before")
                .param("before", jobsBefore).update();
        int notifications = jdbc.sql("DELETE FROM notifications WHERE read_at < :before")
                .param("before", Timestamp.from(now.minus(READ_NOTIFICATIONS_KEPT))).update();
        if (files + translations + classifications + notifications > 0) {
            log.info("Housekeeping removed {} files, {} translation jobs, {} classification jobs, {} notifications",
                    files, translations, classifications, notifications);
        }
    }
}
