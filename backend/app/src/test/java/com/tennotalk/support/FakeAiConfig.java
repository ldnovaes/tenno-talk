package com.tennotalk.support;

import java.util.List;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import com.tennotalk.translation.Translator;

/** Both providers are configured, but answer from memory instead of the real APIs. */
@TestConfiguration(proxyBeanMethods = false)
public class FakeAiConfig {

    @Bean
    FakeTranslators fakeTranslators() {
        return new FakeTranslators();
    }

    @Bean
    @Primary
    List<Translator> fakeTranslatorList(FakeTranslators fakes) {
        return fakes.translators();
    }
}
