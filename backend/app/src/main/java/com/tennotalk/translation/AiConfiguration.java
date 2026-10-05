package com.tennotalk.translation;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.tennotalk.config.TennoProperties;

/** Builds the provider chain: order = priority (OpenAI, then Anthropic); a provider without a key is left out. */
@Configuration
public class AiConfiguration {

    private static final Logger log = LoggerFactory.getLogger(AiConfiguration.class);

    @Bean
    List<Translator> translators(TennoProperties properties, Clock clock) {
        var ai = properties.ai();
        var timeout = properties.translation().timeout();
        List<Translator> translators = new ArrayList<>();
        if (ai.openai().configured()) {
            translators.add(new OpenAiTranslator(ai.openai(), ai.maxOutputTokens(), timeout, clock));
        }
        if (ai.anthropic().configured()) {
            translators.add(new AnthropicTranslator(ai.anthropic(), ai.maxOutputTokens(), timeout, clock));
        }
        if (translators.isEmpty()) log.warn("No AI provider key configured: translations will wait in the queue.");
        return List.copyOf(translators);
    }

    @Bean
    FallbackTranslator fallbackTranslator(List<Translator> translators, ProviderStatusService status,
            TennoProperties properties, Clock clock) {
        return new FallbackTranslator(translators, status, clock, properties.translation().cooldownDefault());
    }
}
