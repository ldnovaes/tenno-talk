package com.tennotalk.translation;

import java.time.Clock;
import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.tennotalk.config.TennoProperties;

/** Builds the provider chain from configuration: order = priority (codex, then claude). */
@Configuration
public class AiConfiguration {

    @Bean
    ErrorClassifier errorClassifier(TennoProperties properties) {
        return new ErrorClassifier(properties.ai().authErrorPatterns(), properties.ai().quotaErrorPatterns());
    }

    @Bean
    List<Translator> translators(TennoProperties properties, ProcessRunner runner, ErrorClassifier classifier) {
        return properties.ai().providers().stream()
                .<Translator>map(provider -> new CliTranslator(provider, runner, classifier, properties.translation().timeout()))
                .toList();
    }

    @Bean
    FallbackTranslator fallbackTranslator(List<Translator> translators, ProviderStatusService status,
            TennoProperties properties, Clock clock) {
        return new FallbackTranslator(translators, status, clock, properties.translation().cooldownDefault());
    }
}
