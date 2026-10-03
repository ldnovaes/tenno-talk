package com.tennotalk.translation;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;


@Service
public class ProviderStatusService {

    private final JdbcClient jdbc;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public ProviderStatusService(JdbcClient jdbc, ApplicationEventPublisher events, Clock clock) {
        this.jdbc = jdbc;
        this.events = events;
        this.clock = clock;
    }

    public List<ProviderState> all() {
        return jdbc.sql("SELECT * FROM ai_provider_status ORDER BY CASE provider WHEN 'codex' THEN 0 ELSE 1 END")
                .query((rs, row) -> new ProviderState(
                        rs.getString("provider"),
                        rs.getString("state"),
                        instant(rs.getTimestamp("until")),
                        rs.getString("last_error"),
                        instant(rs.getTimestamp("checked_at"))))
                .list();
    }

    public ProviderState current(String provider) {
        return all().stream().filter(state -> state.provider().equals(provider)).findFirst()
                .orElse(new ProviderState(provider, ProviderState.OK, null, null, clock.instant()));
    }

    public boolean usable(String provider) {
        return current(provider).usable(clock.instant());
    }

    public void markOk(String provider) {
        ProviderState before = current(provider);
        set(provider, ProviderState.OK, null, null);
        if (!ProviderState.OK.equals(before.state())) events.publishEvent(new ProviderRecovered(provider));
    }

    public void markNeedsReauth(String provider, String error) {
        boolean changed = !ProviderState.NEEDS_REAUTH.equals(current(provider).state());
        set(provider, ProviderState.NEEDS_REAUTH, null, error);
        if (changed) events.publishEvent(new ProviderNeedsReauth(provider, error));
    }

    public void markReauthPending(String provider) {
        set(provider, ProviderState.REAUTH_PENDING, null, current(provider).lastError());
    }

    public void markCoolingDown(String provider, Instant until, String error) {
        set(provider, ProviderState.COOLING_DOWN, until, error);
    }

    /** Cooldowns that ended become ok again (and wake up waiting jobs). */
    @Scheduled(fixedDelayString = "${tenno.ai.recovery-interval:30s}")
    public void recoverExpired() {
        Instant now = clock.instant();
        for (ProviderState state : all()) {
            if (ProviderState.COOLING_DOWN.equals(state.state()) && state.usable(now)) markOk(state.provider());
        }
    }

    private void set(String provider, String state, Instant until, String error) {
        jdbc.sql("UPDATE ai_provider_status SET state = :state, until = :until, last_error = :error, checked_at = :now WHERE provider = :p")
                .param("state", state)
                .param("until", until == null ? null : Timestamp.from(until))
                .param("error", error)
                .param("now", Timestamp.from(clock.instant()))
                .param("p", provider)
                .update();
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

}
