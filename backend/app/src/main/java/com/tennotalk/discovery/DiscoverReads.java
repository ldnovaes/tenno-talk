package com.tennotalk.discovery;

import java.sql.Array;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.MeterRegistry;

/**
 * Read access for the ranking path: every statement has a timeout and runs on its own (no shared transaction),
 * so a slow or failing query degrades one part of the ranking instead of the whole page.
 */
@Component
class DiscoverReads {

    private static final Logger log = LoggerFactory.getLogger(DiscoverReads.class);

    final JdbcClient jdbc;
    private final MeterRegistry meters;

    DiscoverReads(DataSource dataSource, DiscoverProperties properties, MeterRegistry meters) {
        JdbcTemplate template = new JdbcTemplate(dataSource);
        template.setQueryTimeout((int) Math.max(1, properties.queryTimeout().toSeconds()));
        this.jdbc = JdbcClient.create(template);
        this.meters = meters;
    }

    /** {@code query()}, or {@code fallback} when it fails; the failure is logged and counted. */
    <T> T attempt(String part, Supplier<T> query, T fallback) {
        try {
            return query.get();
        } catch (RuntimeException failure) {
            log.warn("Discover degraded: {} failed: {}", part, failure.toString());
            meters.counter("discover.degraded", "part", part).increment();
            return fallback;
        }
    }

    /** A Postgres text[] as a list without nulls. */
    static List<String> strings(Array array) throws SQLException {
        if (array == null) return List.of();
        Object value = array.getArray();
        return value instanceof String[] strings ? Arrays.stream(strings).filter(Objects::nonNull).toList() : List.of();
    }
}
