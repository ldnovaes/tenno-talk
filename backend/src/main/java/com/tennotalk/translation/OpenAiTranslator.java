package com.tennotalk.translation;

import java.time.Clock;
import java.time.Duration;

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

/** Primary provider (PLAN.md §28.1): Chat Completions with a strict JSON schema. */
public class OpenAiTranslator implements Translator {

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
        var params = ChatCompletionCreateParams.builder()
                .model(model)
                .maxCompletionTokens(maxOutputTokens)
                .addSystemMessage(PromptBuilder.SYSTEM)
                .addUserMessage(PromptBuilder.user(request))
                .responseFormat(TranslationJson.class)
                .build();
        StructuredChatCompletion<TranslationJson> completion;
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
        return choice.message().content()
                .flatMap(answer -> answer.toResult(ID))
                .orElseThrow(() -> ApiErrors.transientFailure(ID, "empty translation"));
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
