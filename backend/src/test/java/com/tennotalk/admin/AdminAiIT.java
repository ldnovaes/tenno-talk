package com.tennotalk.admin;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static com.tennotalk.support.TestData.as;
import static com.tennotalk.support.TestData.asAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** PLAN.md §28.3: the admin sees provider health and logs a CLI in again from the phone. */
class AdminAiIT extends IntegrationTest {

    private UUID admin;
    private UUID lucas;
    private UUID cam;

    @BeforeEach
    void people() {
        admin = data.user("admin", "pt-BR");
        data.makeAdmin(admin);
        lucas = data.user("lucas", "pt-BR");
        cam = data.user("cam", "vi-VN");
    }

    private JsonNode adminPost(String path) throws Exception {
        return json.readTree(mvc.perform(post(path).with(asAdmin(admin)).with(csrf()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode aiStatus() throws Exception {
        return json.readTree(mvc.perform(get("/api/admin/ai").with(asAdmin(admin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    /** Without publishing events, so no automatic check races the test. */
    private void brokenLogin(String provider) {
        jdbc.sql("UPDATE ai_provider_status SET state = 'needs_reauth', last_error = 'expired' WHERE provider = :p")
                .param("p", provider).update();
    }

    private String providerState(String provider) {
        return jdbc.sql("SELECT state FROM ai_provider_status WHERE provider = :p").param("p", provider).query(String.class).single();
    }

    private void waitingJob() throws Exception {
        steps.send(lucas, steps.direct(lucas, cam), "Oi!");
        jdbc.sql("UPDATE translation_jobs SET status = 'waiting_provider'").update();
    }

    private String jobStatus() {
        return jdbc.sql("SELECT status FROM translation_jobs").query(String.class).single();
    }

    // ---- access ------------------------------------------------------------

    @Test
    void onlyAdminsGetIn() throws Exception {
        mvc.perform(get("/api/admin/ai")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/ai").with(as(lucas))).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("forbidden"));
        mvc.perform(post("/api/admin/ai/codex/reauth").with(as(lucas)).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/ai/codex/check").with(as(lucas)).with(csrf())).andExpect(status().isForbidden());
        assertThat(ai.calls()).isEmpty();
    }

    @Test
    void adminActionsNeedACsrfToken() throws Exception {
        mvc.perform(post("/api/admin/ai/codex/reauth").with(asAdmin(admin))).andExpect(status().isForbidden());
        assertThat(ai.calls()).isEmpty();
    }

    @Test
    void unknownProvidersAreNotFound() throws Exception {
        mvc.perform(post("/api/admin/ai/gemini/reauth").with(asAdmin(admin)).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(post("/api/admin/ai/gemini/check").with(asAdmin(admin)).with(csrf())).andExpect(status().isNotFound());
    }

    // ---- status ------------------------------------------------------------

    @Test
    void statusListsProvidersInPriorityOrderAndTheQueue() throws Exception {
        steps.send(lucas, steps.direct(lucas, cam), "Oi!");
        JsonNode body = aiStatus();
        assertThat(body.at("/providers/0/provider").asString()).isEqualTo("codex");
        assertThat(body.at("/providers/1/provider").asString()).isEqualTo("claude");
        assertThat(body.at("/providers/0/state").asString()).isEqualTo("ok");
        assertThat(body.at("/queue/pending").asLong()).isOne();
        assertThat(body.at("/queue/waiting_provider").asLong()).isZero();
        assertThat(body.at("/queue/failed").asLong()).isZero();
    }

    @Test
    void statusShowsWhyAProviderIsDown() throws Exception {
        brokenLogin("claude");
        JsonNode body = aiStatus();
        assertThat(body.at("/providers/1/state").asString()).isEqualTo("needs_reauth");
        assertThat(body.at("/providers/1/lastError").asString()).isEqualTo("expired");
    }

    // ---- manual check ------------------------------------------------------

    @Test
    void checkMarksTheProviderOkWhenTheCliIsStillLoggedIn() throws Exception {
        brokenLogin("codex");
        waitingJob();
        ai.statusOk("codex", true);
        JsonNode result = adminPost("/api/admin/ai/codex/check");
        assertThat(result.get("ok").asBoolean()).isTrue();
        assertThat(result.at("/provider/state").asString()).isEqualTo("ok");
        assertThat(ai.calls()).contains(List.of("codex", "login", "status"));
        assertThat(jobStatus()).isEqualTo("pending");
    }

    @Test
    void checkKeepsTheProviderDownWhenTheCliIsLoggedOut() throws Exception {
        brokenLogin("codex");
        waitingJob();
        ai.statusOk("codex", false);
        JsonNode result = adminPost("/api/admin/ai/codex/check");
        assertThat(result.get("ok").asBoolean()).isFalse();
        assertThat(result.at("/provider/state").asString()).isEqualTo("needs_reauth");
        assertThat(jobStatus()).isEqualTo("waiting_provider");
    }

    @Test
    void manualChecksAreNotThrottled() throws Exception {
        brokenLogin("codex");
        adminPost("/api/admin/ai/codex/check");
        adminPost("/api/admin/ai/codex/check");
        assertThat(ai.calls().stream().filter(c -> c.equals(List.of("codex", "login", "status")))).hasSize(2);
    }

    // ---- assisted login ----------------------------------------------------

    @Test
    void reauthReturnsTheDeviceLinkAndCode() throws Exception {
        brokenLogin("codex");
        JsonNode challenge = adminPost("/api/admin/ai/codex/reauth");
        assertThat(challenge.get("provider").asString()).isEqualTo("codex");
        assertThat(challenge.get("verificationUrl").asString()).isEqualTo("https://auth.example.com/device");
        assertThat(challenge.get("userCode").asString()).isEqualTo("ABCD-1234");
        assertThat(ai.calls()).contains(List.of("codex", "login", "--device-auth"));
        assertThat(providerState("codex")).isEqualTo("reauth_pending");
    }

    @Test
    void approvingTheLoginBringsTheProviderBackAndResumesWaitingTranslations() throws Exception {
        brokenLogin("codex");
        waitingJob();
        adminPost("/api/admin/ai/codex/reauth");
        assertThat(jobStatus()).isEqualTo("waiting_provider");

        ai.approveLogin(0);

        await().atMost(Duration.ofSeconds(5)).until(() -> providerState("codex").equals("ok"));
        await().atMost(Duration.ofSeconds(5)).until(() -> jobStatus().equals("pending"));
    }

    @Test
    void aFailedLoginLeavesTheProviderWaitingForAnotherTry() throws Exception {
        brokenLogin("claude");
        adminPost("/api/admin/ai/claude/reauth");
        assertThat(ai.calls()).contains(List.of("claude", "setup-token"));
        ai.approveLogin(1);
        await().atMost(Duration.ofSeconds(5)).until(() -> providerState("claude").equals("needs_reauth"));
    }

    @Test
    void startingAgainReplacesThePendingLogin() throws Exception {
        brokenLogin("codex");
        adminPost("/api/admin/ai/codex/reauth");
        ai.reset();
        adminPost("/api/admin/ai/codex/reauth");
        assertThat(providerState("codex")).isEqualTo("reauth_pending");
        ai.approveLogin(0);
        await().atMost(Duration.ofSeconds(5)).until(() -> providerState("codex").equals("ok"));
    }
}
