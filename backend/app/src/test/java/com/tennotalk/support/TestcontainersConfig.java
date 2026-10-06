package com.tennotalk.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** One real PostgreSQL for the whole test run (shared by every cached context). */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfig {

    /** Production runs Postgres 14 (shared VPS) and 16 (dedicated stack): -Dtenno.postgres=14 tests the other one. */
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:" + System.getProperty("tenno.postgres", "16") + "-alpine");

    /** For tests that need a database of their own on the same server (migrations from an old version). */
    public static PostgreSQLContainer container() {
        return POSTGRES;
    }

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return POSTGRES;
    }
}
