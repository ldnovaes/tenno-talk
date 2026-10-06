package com.tennotalk.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * One real PostgreSQL for the whole test run (shared by every cached context). It is not a bean: Spring would
 * stop it when the first cached context closes at exit, and the others would then wait 30 s on dead
 * connections before Surefire kills the JVM. Ryuk removes the container when the JVM ends.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfig {

    /** Production runs Postgres 14 (shared VPS) and 16 (dedicated stack): -Dtenno.postgres=14 tests the other one. */
    static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:" + System.getProperty("tenno.postgres", "16") + "-alpine");

    static {
        POSTGRES.start();
    }

    /** For tests that need a database of their own on the same server (migrations from an old version). */
    public static PostgreSQLContainer container() {
        return POSTGRES;
    }

    @Bean
    DynamicPropertyRegistrar postgresProperties() {
        return registry -> {
            registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
            registry.add("spring.datasource.username", POSTGRES::getUsername);
            registry.add("spring.datasource.password", POSTGRES::getPassword);
        };
    }
}
