package com.tennotalk.discovery;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps discover data small and within the privacy policy: processed events older than the retention, expired
 * sessions and interests that decayed to nothing are deleted.
 */
@Component
public class DiscoverRetention {

    /** An interest whose decayed magnitude is below this no longer moves any ranking. */
    static final double NEGLIGIBLE = 0.01;

    private final JdbcClient jdbc;
    private final DiscoverSessions sessions;
    private final DiscoverProperties properties;
    private final Clock clock;

    public DiscoverRetention(JdbcClient jdbc, DiscoverSessions sessions, DiscoverProperties properties, Clock clock) {
        this.jdbc = jdbc;
        this.sessions = sessions;
        this.properties = properties;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${tenno.discover.retention-interval:1h}", initialDelayString = "${tenno.discover.retention-delay:5m}")
    public void poll() {
        if (properties.workerEnabled()) runOnce();
    }

    public void runOnce() {
        Instant now = clock.instant();
        jdbc.sql("DELETE FROM interaction_events WHERE processed_at IS NOT NULL AND occurred_at < :before")
                .param("before", Timestamp.from(now.minus(properties.eventRetention()))).update();
        sessions.deleteExpired(now);
        jdbc.sql("""
                DELETE FROM user_affinities
                WHERE abs(score) * power(0.5, extract(epoch FROM (:now - updated_at)) / :halfLife) < :negligible
                """).param("now", Timestamp.from(now)).param("halfLife", (double) properties.affinityHalfLife().toSeconds())
                .param("negligible", NEGLIGIBLE).update();
    }
}
