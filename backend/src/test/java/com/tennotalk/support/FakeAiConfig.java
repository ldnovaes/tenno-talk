package com.tennotalk.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** The real CLI translators run against fake processes. */
@TestConfiguration(proxyBeanMethods = false)
public class FakeAiConfig {

    @Bean
    @Primary
    FakeProcessRunner fakeProcessRunner() {
        return new FakeProcessRunner();
    }
}
