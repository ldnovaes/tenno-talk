package com.tennotalk.translation;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.errors.OpenAIException;
import com.openai.errors.OpenAIServiceException;
import com.openai.models.chat.completions.ChatCompletion;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import com.openai.models.chat.completions.StructuredChatCompletion;
import com.tennotalk.config.TennoProperties;

/** Primary provider (PLAN.md §28.1): Chat Completions with a strict JSON schema; also labels topics (§37.5). */
public class OpenAiTranslator implements Translator, TopicClassifier {

    public static final String ID = "openai";

    private static final Logger log = LoggerFactory.getLogger(OpenAiTranslator.class);

    private final OpenAIClient client;
    private final String model;
    private final long maxOutputTokens;
    private final Clock clock;

    public OpenAiTranslator(TennoProperties.Provider config, int maxOutputTokens, Duration timeout, Clock clock) {
        OpenAIOkHttpClient.Builder builder = OpenAIOkHttpClient.builder()
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

    /** One Chat Completions call with a strict JSON schema derived from {@code schema}. */
    private <T> T complete(String system, String user, Class<T> schema, long maxTokens) throws TranslatorException {
        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .maxCompletionTokens(maxTokens)
                .addSystemMessage(system)
                .addUserMessage(user)
                .responseFormat(schema)
                .build();
        StructuredChatCompletion<T> completion;
        try {
            completion = client.chat().completions().create(params);
        } catch (OpenAIServiceException exception) {
            throw ApiErrors.classify(ID, exception.statusCode(), exception.code().orElse(null),
                    exception.headers().values("retry-after").stream().findFirst().orElse(null),
                    exception.getMessage(), clock.instant());
        } catch (OpenAIException exception) {
            // Network, timeout or an answer that does not match the schema.
            throw ApiErrors.transientFailure(ID, exception.getMessage());
        }
        completion.usage().ifPresent(usage ->
                log.info("AI usage provider={} model={} input={} output={}", ID, model, usage.promptTokens(), usage.completionTokens()));
        var choice = completion.choices().stream().findFirst()
                .orElseThrow(() -> ApiErrors.transientFailure(ID, "no choices"));
        if (!ChatCompletion.Choice.FinishReason.STOP.equals(choice.finishReason())) {
            throw ApiErrors.transientFailure(ID, "finish reason " + choice.finishReason());
        }
        if (choice.message().refusal().isPresent()) {
            throw ApiErrors.transientFailure(ID, "refused: " + choice.message().refusal().get());
        }
        return choice.message().content().orElseThrow(() -> ApiErrors.transientFailure(ID, "empty answer"));
    }

    @Override
    public void check() throws TranslatorException {
        try {
            client.models().retrieve(model);
        } catch (OpenAIServiceException exception) {
            throw ApiErrors.classify(ID, exception.statusCode(), exception.code().orElse(null), null,
                    exception.getMessage(), clock.instant());
        } catch (OpenAIException exception) {
            throw ApiErrors.transientFailure(ID, exception.getMessage());
        }
    }
}
