package com.tennotalk.admin;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static com.tennotalk.support.TestData.as;
import static com.tennotalk.support.TestData.asAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** PLAN.md §28.3: the admin sees provider health and checks a replaced key. */
class AdminAiIT extends IntegrationTest {

    private UUID admin;
    private UUID rafael;
    private UUID linh;

    @BeforeEach
    void people() {
        admin = data.user("admin", "pt-BR");
        data.makeAdmin(admin);
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
    }

    private JsonNode adminPost(String path) throws Exception {
        return json.readTree(mvc.perform(post(path).with(asAdmin(admin)).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode aiStatus() throws Exception {
        return json.readTree(mvc.perform(get("/api/admin/ai").with(asAdmin(admin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    /** Without publishing events, so nothing else reacts during the test. */
    private void rejectedKey(String provider) {
        jdbc.sql("UPDATE ai_provider_status SET state = 'invalid_key', last_error = 'openai 401: invalid key' WHERE provider = :p")
                .param("p", provider).update();
    }

    private void waitingJob() throws Exception {
        steps.send(rafael, steps.direct(rafael, linh), "Oi!");
        jdbc.sql("UPDATE translation_jobs SET status = 'waiting_provider'").update();
    }

    private String jobStatus() {
        return jdbc.sql("SELECT status FROM translation_jobs").query(String.class).single();
    }

    // ---- access ------------------------------------------------------------

    @Test
    void onlyAdminsGetIn() throws Exception {
        mvc.perform(get("/api/admin/ai")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/ai").with(as(rafael))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("forbidden"));
        mvc.perform(post("/api/admin/ai/openai/check").with(as(rafael)).with(csrf())).andExpect(status().isForbidden());
        assertThat(ai.checkCalls("openai")).isZero();
    }

    @Test
    void adminActionsNeedACsrfToken() throws Exception {
        mvc.perform(post("/api/admin/ai/openai/check").with(asAdmin(admin))).andExpect(status().isForbidden());
        assertThat(ai.checkCalls("openai")).isZero();
    }

    @Test
    void unknownProvidersAreNotFound() throws Exception {
        mvc.perform(post("/api/admin/ai/gemini/check").with(asAdmin(admin)).with(csrf())).andExpect(status().isNotFound());
    }

    @Test
    void theOldLoginEndpointIsGone() throws Exception {
        mvc.perform(post("/api/admin/ai/openai/reauth").with(asAdmin(admin)).with(csrf())).andExpect(status().isNotFound());
    }

    // ---- status ------------------------------------------------------------

    @Test
    void statusListsProvidersInPriorityOrderWithTheirModelsAndTheQueue() throws Exception {
        steps.send(rafael, steps.direct(rafael, linh), "Oi!");
        JsonNode body = aiStatus();
        assertThat(body.at("/providers/0/provider").asString()).isEqualTo("openai");
        assertThat(body.at("/providers/0/model").asString()).isEqualTo("gpt-test");
        assertThat(body.at("/providers/1/provider").asString()).isEqualTo("anthropic");
        assertThat(body.at("/providers/1/model").asString()).isEqualTo("claude-test");
        assertThat(body.at("/providers/0/state").asString()).isEqualTo("ok");
        assertThat(body.at("/queue/pending").asLong()).isOne();
        assertThat(body.at("/queue/waiting_provider").asLong()).isZero();
        assertThat(body.at("/queue/failed").asLong()).isZero();
    }

    @Test
    void statusShowsWhyAProviderIsDown() throws Exception {
        rejectedKey("anthropic");
        JsonNode body = aiStatus();
        assertThat(body.at("/providers/1/state").asString()).isEqualTo("invalid_key");
        assertThat(body.at("/providers/1/lastError").asString()).isEqualTo("openai 401: invalid key");
    }

    // ---- manual check ------------------------------------------------------

    @Test
    void checkMarksTheProviderOkOnceTheKeyWorksAndResumesWaitingTranslations() throws Exception {
        rejectedKey("openai");
        waitingJob();
        JsonNode result = adminPost("/api/admin/ai/openai/check");
        assertThat(result.get("ok").asBoolean()).isTrue();
        assertThat(result.at("/provider/state").asString()).isEqualTo("ok");
        assertThat(ai.checkCalls("openai")).isOne();
        assertThat(jobStatus()).isEqualTo("pending");
    }

    @Test
    void checkKeepsTheProviderDownWhileTheKeyIsRejected() throws Exception {
        rejectedKey("openai");
        waitingJob();
        ai.checkOk("openai", false);
        JsonNode result = adminPost("/api/admin/ai/openai/check");
        assertThat(result.get("ok").asBoolean()).isFalse();
        assertThat(result.at("/provider/state").asString()).isEqualTo("invalid_key");
        assertThat(jobStatus()).isEqualTo("waiting_provider");
    }

    @Test
    void aFailedCheckOfAHealthyProviderMarksTheKeyInvalid() throws Exception {
        ai.checkOk("anthropic", false);
        JsonNode result = adminPost("/api/admin/ai/anthropic/check");
        assertThat(result.at("/provider/state").asString()).isEqualTo("invalid_key");
    }
}
