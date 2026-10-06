package com.tennotalk.translation;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.tennotalk.support.FakeTranslators.Mode;
import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static com.tennotalk.support.TestData.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** PLAN.md §28: OpenAI first, Anthropic as fallback, nothing lost when both are down. */
class TranslationPipelineIT extends IntegrationTest {

    @Autowired
    TranslationWorker worker;

    @Autowired
    ProviderStatusService providers;

    @Autowired
    ProviderHealthService health;

    private UUID rafael;
    private UUID linh;
    private UUID conversation;

    @BeforeEach
    void chat() throws Exception {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
        conversation = steps.direct(rafael, linh);
    }

    private JsonNode linhView() throws Exception {
        return steps.lastMessage(linh, conversation);
    }

    private String jobStatus() {
        return jdbc.sql("SELECT status FROM translation_jobs ORDER BY id DESC LIMIT 1").query(String.class).single();
    }

    private String providerState(String provider) {
        return providers.current(provider).state();
    }

    @Test
    void openAiTranslatesWithConversationContext() throws Exception {
        steps.send(linh, conversation, "Chào anh!");
        jdbc.sql("UPDATE translation_jobs SET status = 'done'").update();
        steps.send(rafael, conversation, "Estou com saudade de você.");
        assertThat(linhView().at("/translation/status").asString()).isEqualTo("pending");

        assertThat(worker.runOnce()).isEqualTo(1);

        JsonNode translated = linhView();
        assertThat(translated.at("/translation/status").asString()).isEqualTo("translated");
        assertThat(translated.at("/translation/text").asString()).isEqualTo("[Vietnamese (Vietnam)] Estou com saudade de você.");
        assertThat(translated.at("/translation/version").asInt()).isEqualTo(1);
        assertThat(translated.at("/content/body/text").asString()).isEqualTo("Estou com saudade de você.");
        assertThat(ai.translationCalls("openai")).isOne();
        assertThat(ai.translationCalls("anthropic")).isZero();
        TranslationRequest request = ai.lastRequest("openai");
        assertThat(request.sourceLanguage()).isEqualTo("pt-BR");
        assertThat(request.targetLanguage()).isEqualTo("vi-VN");
        assertThat(PromptBuilder.user(request)).contains("Target language: Vietnamese (Vietnam)")
                .contains("Probable source language: Portuguese (Brazil)")
                .contains("- Linh: Chào anh!");
        assertThat(jobStatus()).isEqualTo("done");
        String provider = jdbc.sql("SELECT provider FROM message_translations WHERE status = 'translated'").query(String.class).single();
        assertThat(provider).isEqualTo("openai");
    }

    private void changeReceivingLanguage(UUID user, String language) throws Exception {
        mvc.perform(withJson(patch("/api/me/preferences"), Map.of("translation", Map.of("receivingLanguage", language)))
                .with(as(user))).andExpect(status().isOk());
    }

    private long jobs() {
        return jdbc.sql("SELECT count(*) FROM translation_jobs").query(Long.class).single();
    }

    @Test
    void changingTheReceivingLanguageNeverTranslatesThePastAgain() throws Exception {
        steps.send(rafael, conversation, "Oi");
        worker.runOnce();
        changeReceivingLanguage(linh, "en-US");
        long jobsBefore = jobs();

        // Opening the conversation and the chat list after the change costs nothing.
        JsonNode old = linhView();
        assertThat(old.at("/translation/targetLanguage").asString()).isEqualTo("vi-VN");
        assertThat(old.at("/translation/text").asString()).isEqualTo("[Vietnamese (Vietnam)] Oi");
        steps.conversations(linh);
        assertThat(jobs()).isEqualTo(jobsBefore);
        assertThat(worker.runOnce()).isZero();

        // Only what arrives after the change uses the new language.
        steps.send(rafael, conversation, "Tudo bem?");
        worker.runOnce();
        JsonNode linhItems = steps.messages(linh, conversation).get("items");
        assertThat(linhItems.get(0).at("/translation/text").asString()).isEqualTo("[Vietnamese (Vietnam)] Oi");
        assertThat(linhItems.get(1).at("/translation/text").asString()).isEqualTo("[English (United States)] Tudo bem?");
        // The sender sees what Linh received each time.
        JsonNode rafaelItems = steps.messages(rafael, conversation).get("items");
        assertThat(rafaelItems.get(0).at("/translation/targetLanguage").asString()).isEqualTo("vi-VN");
        assertThat(rafaelItems.get(1).at("/translation/targetLanguage").asString()).isEqualTo("en-US");
        assertThat(ai.translationCalls("openai")).isEqualTo(2);
    }

    @Test
    void switchingBackToAnEarlierLanguageStillOnlyAffectsNewMessages() throws Exception {
        changeReceivingLanguage(linh, "en-US");
        steps.send(rafael, conversation, "Oi");
        worker.runOnce();
        changeReceivingLanguage(linh, "vi-VN");
        steps.send(rafael, conversation, "Tchau");
        worker.runOnce();
        JsonNode items = steps.messages(linh, conversation).get("items");
        assertThat(items.get(0).at("/translation/targetLanguage").asString()).isEqualTo("en-US");
        assertThat(items.get(1).at("/translation/targetLanguage").asString()).isEqualTo("vi-VN");
        assertThat(jdbc.sql("SELECT count(*) FROM receiving_language_history WHERE user_id = :id").param("id", linh)
                .query(Long.class).single()).isEqualTo(3);
    }

    @Test
    void anthropicIsUsedOnlyWhenTheOpenAiKeyIsRejected() throws Exception {
        ai.mode("openai", Mode.AUTH);
        steps.send(rafael, conversation, "Oi");
        worker.runOnce();
        assertThat(linhView().at("/translation/text").asString()).isEqualTo("[Vietnamese (Vietnam)] Oi");
        assertThat(jdbc.sql("SELECT provider FROM message_translations").query(String.class).single()).isEqualTo("anthropic");
        assertThat(providerState("openai")).isEqualTo(ProviderState.INVALID_KEY);
        assertThat(providers.current("openai").lastError()).contains("401");

        // Next message skips OpenAI right away (no wasted call).
        steps.send(rafael, conversation, "Tudo bem?");
        worker.runOnce();
        assertThat(ai.translationCalls("openai")).isOne();
        assertThat(ai.translationCalls("anthropic")).isEqualTo(2);
    }

    @Test
    void whenBothKeysAreRejectedNothingIsLostAndWorkResumesOnceAKeyWorks() throws Exception {
        ai.mode("openai", Mode.AUTH);
        ai.mode("anthropic", Mode.AUTH);
        steps.send(rafael, conversation, "Eu te amo");
        worker.runOnce();

        JsonNode waiting = linhView();
        assertThat(waiting.at("/content/body/text").asString()).isEqualTo("Eu te amo");
        assertThat(waiting.at("/translation/status").asString()).isEqualTo("pending");
        assertThat(jobStatus()).isEqualTo("waiting_provider");
        int attempts = jdbc.sql("SELECT attempts FROM translation_jobs").query(Integer.class).single();
        assertThat(attempts).isZero();
        assertThat(worker.runOnce()).isZero();

        // The admin replaces the OpenAI key and checks it: the queue resumes.
        ai.mode("openai", Mode.OK);
        assertThat(health.checkNow("openai")).isTrue();
        assertThat(jobStatus()).isEqualTo("pending");
        worker.runOnce();
        assertThat(linhView().at("/translation/text").asString()).isEqualTo("[Vietnamese (Vietnam)] Eu te amo");
    }

    @Test
    void quotaCoolsTheProviderDownAndItComesBackByItself() throws Exception {
        ai.mode("openai", Mode.QUOTA);
        steps.send(rafael, conversation, "Oi");
        worker.runOnce();
        assertThat(providerState("openai")).isEqualTo(ProviderState.COOLING_DOWN);
        // The retry-after of the 429 (120s) sets when it comes back.
        assertThat(providers.current("openai").until()).isBetween(Instant.now().plusSeconds(100), Instant.now().plusSeconds(121));
        assertThat(linhView().at("/translation/status").asString()).isEqualTo("translated");

        jdbc.sql("UPDATE ai_provider_status SET until = now() - interval '1 minute' WHERE provider = 'openai'").update();
        providers.recoverExpired();
        assertThat(providerState("openai")).isEqualTo(ProviderState.OK);
    }

    @Test
    void exhaustedCreditsCoolDownForTheDefaultPeriod() throws Exception {
        ai.mode("openai", Mode.CREDITS);
        steps.send(rafael, conversation, "Oi");
        worker.runOnce();
        assertThat(providerState("openai")).isEqualTo(ProviderState.COOLING_DOWN);
        assertThat(providers.current("openai").until()).isAfter(Instant.now().plusSeconds(14 * 60));
        assertThat(jdbc.sql("SELECT provider FROM message_translations").query(String.class).single()).isEqualTo("anthropic");
    }

    @Test
    void transientErrorsAreRetriedWithBackoffThenFail() throws Exception {
        ai.mode("openai", Mode.TRANSIENT);
        ai.mode("anthropic", Mode.GARBAGE);
        steps.send(rafael, conversation, "Oi");
        worker.runOnce();
        // Each provider got a second chance before giving up on this round.
        assertThat(ai.translationCalls("openai")).isEqualTo(2);
        assertThat(ai.translationCalls("anthropic")).isEqualTo(2);
        assertThat(jobStatus()).isEqualTo("pending");
        assertThat(jdbc.sql("SELECT run_after > now() FROM translation_jobs").query(Boolean.class).single()).isTrue();
        assertThat(linhView().at("/translation/status").asString()).isEqualTo("pending");

        for (int round = 0; round < 2; round++) {
            jdbc.sql("UPDATE translation_jobs SET run_after = now() - interval '1 second'").update();
            worker.runOnce();
        }
        assertThat(jobStatus()).isEqualTo("failed");
        assertThat(linhView().at("/translation/status").asString()).isEqualTo("failed");
        assertThat(linhView().at("/content/body/text").asString()).isEqualTo("Oi");
    }

    @Test
    void anInvalidAnswerCountsAsTransient() throws Exception {
        ai.mode("openai", Mode.GARBAGE);
        steps.send(rafael, conversation, "Oi");
        worker.runOnce();
        assertThat(providerState("openai")).isEqualTo(ProviderState.OK);
        assertThat(jdbc.sql("SELECT provider FROM message_translations").query(String.class).single()).isEqualTo("anthropic");
    }

    @Test
    void manualRetryAfterAFailureTranslatesAgain() throws Exception {
        steps.send(linh, conversation, "Em nhớ anh.");
        String id = linhView().get("id").asString();
        jdbc.sql("UPDATE message_translations SET status = 'failed'").update();
        jdbc.sql("UPDATE translation_jobs SET status = 'failed', attempts = 3").update();

        mvc.perform(post("/api/messages/" + id + "/translation/retry").with(as(rafael)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("pending"))
                .andExpect(jsonPath("$.targetLanguage").value("pt-BR"));
        assertThat(jdbc.sql("SELECT attempts FROM translation_jobs").query(Integer.class).single()).isZero();
        worker.runOnce();
        assertThat(steps.lastMessage(rafael, conversation).at("/translation/status").asString()).isEqualTo("translated");
    }

    @Test
    void retryIsRefusedWhenThereIsNothingToTranslateOrForOutsiders() throws Exception {
        UUID minh = data.user("minh", "vi-VN");
        UUID sameLanguage = steps.direct(linh, minh);
        String id = steps.send(minh, sameLanguage, "Đi chứ").get("id").asString();
        mvc.perform(post("/api/messages/" + id + "/translation/retry").with(as(linh)).with(csrf())).andExpect(status().isBadRequest());
        mvc.perform(post("/api/messages/" + id + "/translation/retry").with(as(rafael)).with(csrf())).andExpect(status().isForbidden());
    }

    @Test
    void aNewTranslationAfterAFailureHasAHigherVersion() throws Exception {
        steps.send(rafael, conversation, "Oi");
        worker.runOnce();
        String id = linhView().get("id").asString();
        jdbc.sql("UPDATE message_translations SET status = 'failed'").update();
        mvc.perform(post("/api/messages/" + id + "/translation/retry").with(as(linh)).with(csrf()))
                .andExpect(jsonPath("$.version").value(1));
        worker.runOnce();
        assertThat(linhView().at("/translation/version").asInt()).isEqualTo(2);
    }

    @Test
    void retryingWhatIsTranslatedOrQueuedCostsNoAiCall() throws Exception {
        steps.send(rafael, conversation, "Oi");
        String id = linhView().get("id").asString();
        // Still queued: retrying does not add work.
        mvc.perform(post("/api/messages/" + id + "/translation/retry").with(as(linh)).with(csrf()))
                .andExpect(jsonPath("$.status").value("pending"));
        worker.runOnce();
        assertThat(jdbc.sql("SELECT count(*) FROM translation_jobs WHERE status = 'pending'").query(Long.class).single()).isZero();
        // Translated: retrying (even in a loop) never re-sends the text to the AI.
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/messages/" + id + "/translation/retry").with(as(linh)).with(csrf()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("translated"));
        }
        assertThat(jdbc.sql("SELECT count(*) FROM translation_jobs WHERE status = 'pending'").query(Long.class).single()).isZero();
        assertThat(linhView().at("/translation/version").asInt()).isEqualTo(1);
    }

    @Test
    void learningModeInsightHasNaturalAndLiteral() throws Exception {
        steps.send(linh, conversation, "Em nhớ anh.");
        String id = linhView().get("id").asString();
        mvc.perform(get("/api/messages/" + id + "/insight").param("lang", "pt-BR").with(as(rafael))).andExpect(status().isNotFound());
        worker.runOnce();
        mvc.perform(get("/api/messages/" + id + "/insight").param("lang", "pt-BR").with(as(rafael)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.natural").value("[Portuguese (Brazil)] Em nhớ anh."))
                .andExpect(jsonPath("$.literal").value("[Portuguese (Brazil) literal] Em nhớ anh."))
                .andExpect(jsonPath("$.vocabulary").isArray());
        mvc.perform(get("/api/messages/" + id + "/insight").param("lang", "vi-VN").with(as(rafael))).andExpect(status().isBadRequest());
    }

    @Test
    void staleRunningJobsAreReleased() throws Exception {
        steps.send(rafael, conversation, "Oi");
        jdbc.sql("UPDATE translation_jobs SET status = 'running', locked_at = now() - interval '1 hour'").update();
        assertThat(worker.runOnce()).isEqualTo(1);
        assertThat(jobStatus()).isEqualTo("done");
    }

    @Test
    void unknownContentKindsAreNotFound() throws Exception {
        mvc.perform(post("/api/translations/banana/" + UUID.randomUUID()).param("lang", "pt-BR").with(as(rafael)).with(csrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    void healthyInputsAreUntouchedByTheWorker() throws Exception {
        assertThat(worker.runOnce()).isZero();
        assertThat(Map.of()).isEmpty();
    }
}
