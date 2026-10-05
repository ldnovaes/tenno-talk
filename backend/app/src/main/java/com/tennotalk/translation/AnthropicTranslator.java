package com.tennotalk.translation;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.errors.AnthropicException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.models.ErrorType;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.StopReason;
import com.anthropic.models.messages.StructuredMessage;
import com.tennotalk.config.TennoProperties;

/** Fallback provider (PLAN.md §28.1): Messages API with structured output; also labels topics (§37.5). */
public class AnthropicTranslator implements Translator, TopicClassifier {

    public static final String ID = "anthropic";

    private static final Logger log = LoggerFactory.getLogger(AnthropicTranslator.class);

    private final AnthropicClient client;
    private final String model;
    private final long maxOutputTokens;
    private final Clock clock;

    public AnthropicTranslator(TennoProperties.Provider config, int maxOutputTokens, Duration timeout, Clock clock) {
        AnthropicOkHttpClient.Builder builder = AnthropicOkHttpClient.builder()
                .apiKey(config.apiKey())
                .timeout(timeout)
                // FallbackTranslator owns the retry policy.
                .maxRetries(0);
        if (config.baseUrl() != null && !config.baseUrl().isBlank()) builder.baseUrl(config.baseUrl());
        this.client = builder.build();
        this.model = config.model();
        this.maxOutputTokens = maxOutputTokens;
        this.clock = clock;
    }

    @Override
    public String id() {
        return ID;
    }

    @Override
    public String model() {
        return model;
    }

    @Override
    public TranslationResult translate(TranslationRequest request) throws TranslatorException {
        return complete(PromptBuilder.SYSTEM, PromptBuilder.user(request), TranslationJson.class, maxOutputTokens)
                .toResult(ID).orElseThrow(() -> ApiErrors.transientFailure(ID, "empty translation"));
    }

    @Override
    public List<String> classifyTopics(String caption, List<String> taxonomy) throws TranslatorException {
        return complete(TopicPrompt.SYSTEM, TopicPrompt.user(caption, taxonomy), TopicsJson.class,
                Math.min(maxOutputTokens, TopicPrompt.MAX_OUTPUT_TOKENS)).valid(taxonomy);
    }

    /** One Messages call with structured output derived from {@code schema}. */
    private <T> T complete(String system, String user, Class<T> schema, long maxTokens) throws TranslatorException {
        var params = MessageCreateParams.builder()
                .model(model)
                .maxTokens(maxTokens)
                .system(system)
                .addUserMessage(user)
                .outputConfig(schema)
                .build();
        StructuredMessage<T> message;
        try {
            message = client.messages().create(params);
        } catch (AnthropicServiceException exception) {
            throw ApiErrors.classify(ID, exception.statusCode(), errorType(exception),
                    exception.headers().values("retry-after").stream().findFirst().orElse(null),
                    exception.getMessage(), clock.instant());
        } catch (AnthropicException exception) {
            // Network, timeout or an answer that does not match the schema.
            throw ApiErrors.transientFailure(ID, exception.getMessage());
        }
        log.info("AI usage provider={} model={} input={} output={}", ID, model,
                message.usage().inputTokens(), message.usage().outputTokens());
        StopReason stop = message.stopReason().orElse(null);
        if (!StopReason.END_TURN.equals(stop)) {
            // refusal, max_tokens…: the next provider (or a retry) gets the job.
            throw ApiErrors.transientFailure(ID, "stop reason " + stop);
        }
        return message.content().stream()
                .flatMap(block -> block.text().stream())
                .findFirst()
                .map(block -> block.text())
                .orElseThrow(() -> ApiErrors.transientFailure(ID, "empty answer"));
    }

    @Override
    public void check() throws TranslatorException {
        try {
            client.models().retrieve(model);
        } catch (AnthropicServiceException exception) {
            throw ApiErrors.classify(ID, exception.statusCode(), errorType(exception), null,
                    exception.getMessage(), clock.instant());
        } catch (AnthropicException exception) {
            throw ApiErrors.transientFailure(ID, exception.getMessage());
        }
    }

    private static String errorType(AnthropicServiceException exception) {
        return exception.errorType().map(ErrorType::asString).orElse(null);
    }
}
