package com.tennotalk.moderation;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static com.tennotalk.support.TestData.asAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ReportsIT extends IntegrationTest {

    private UUID lucas;
    private UUID cam;
    private UUID admin;

    @BeforeEach
    void people() {
        lucas = data.user("lucas", "pt-BR");
        cam = data.user("cam", "vi-VN");
        admin = data.user("admin", "en-US");
        data.makeAdmin(admin);
    }

    private JsonNode report(UUID reporter, String kind, Object id, String reason) throws Exception {
        return api.postOk(reporter, "/api/reports", Map.of("targetKind", kind, "targetId", id, "reason", reason));
    }

    private JsonNode adminList(String status) throws Exception {
        return json.readTree(mvc.perform(get("/api/admin/reports").param("status", status).with(asAdmin(admin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void peopleCanBeReportedAndAdminsSeeIt() throws Exception {
        JsonNode created = report(lucas, "user", cam, "harassment");
        assertThat(created.get("status").asString()).isEqualTo("open");
        JsonNode open = adminList("open");
        assertThat(open.size()).isOne();
        assertThat(open.at("/0/targetId").asString()).isEqualTo(cam.toString());
        assertThat(open.at("/0/reason").asString()).isEqualTo("harassment");
        assertThat(open.at("/0/reporterUsername").asString()).isEqualTo("lucas");
    }

    @Test
    void reportingTwiceKeepsOneOpenReport() throws Exception {
        String first = report(lucas, "user", cam, "spam").get("id").asString();
        String second = report(lucas, "user", cam, "spam").get("id").asString();
        assertThat(second).isEqualTo(first);
        assertThat(adminList("open").size()).isOne();
    }

    @Test
    void messagesCanBeReportedOnlyByMembers() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        String message = steps.send(cam, conversation, "spam spam").get("id").asString();
        report(lucas, "message", message, "spam");

        UUID ana = data.user("ana", "es-ES");
        api.post(ana, "/api/reports", Map.of("targetKind", "message", "targetId", message, "reason", "spam"))
                .andExpect(status().isNotFound());
    }

    @Test
    void hiddenContentCannotBeReported() throws Exception {
        String post = api.postOk(cam, "/api/posts", Map.of("mediaIds", List.of(data.media(cam, "image")))).get("id").asString();
        data.setPreference(cam, "profile_visibility", "private");
        api.post(lucas, "/api/reports", Map.of("targetKind", "post", "targetId", post, "reason", "spam"))
                .andExpect(status().isNotFound());
        data.follow(lucas, cam);
        report(lucas, "post", post, "spam");
    }

    @Test
    void postsCommentsAndStoriesCanBeReported() throws Exception {
        String post = api.postOk(cam, "/api/posts", Map.of("mediaIds", List.of(data.media(cam, "image")))).get("id").asString();
        String comment = api.postOk(cam, "/api/posts/" + post + "/comments", Map.of("text", "x")).get("id").asString();
        String story = api.postOk(cam, "/api/stories", Map.of("mediaId", data.media(cam, "image"))).get("id").asString();
        report(lucas, "post", post, "violence");
        report(lucas, "comment", comment, "hate");
        report(lucas, "story", story, "sexual");
        assertThat(adminList("open").size()).isEqualTo(3);
    }

    @Test
    void invalidReportsAreRejected() throws Exception {
        api.post(lucas, "/api/reports", Map.of("targetKind", "user", "targetId", lucas, "reason", "spam"))
                .andExpect(status().isBadRequest());
        api.post(lucas, "/api/reports", Map.of("targetKind", "planet", "targetId", cam, "reason", "spam"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.targetKind").exists());
        api.post(lucas, "/api/reports", Map.of("targetKind", "user", "targetId", cam, "reason", "boring"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.reason").exists());
        api.post(lucas, "/api/reports", Map.of("targetKind", "user", "targetId", UUID.randomUUID(), "reason", "spam"))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminsResolveReports() throws Exception {
        String id = report(lucas, "user", cam, "spam").get("id").asString();
        mvc.perform(patch("/api/admin/reports/" + id).with(asAdmin(admin)).with(csrf())
                        .contentType("application/json").content("{\"status\":\"dismissed\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("dismissed"));
        assertThat(adminList("open").size()).isZero();
        assertThat(adminList("dismissed").size()).isOne();
        // After a resolution, a new report can be opened again.
        assertThat(report(lucas, "user", cam, "spam").get("id").asString()).isNotEqualTo(id);
    }

    @Test
    void resolutionsAreValidated() throws Exception {
        String id = report(lucas, "user", cam, "spam").get("id").asString();
        mvc.perform(patch("/api/admin/reports/" + id).with(asAdmin(admin)).with(csrf())
                        .contentType("application/json").content("{\"status\":\"open\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/admin/reports/" + UUID.randomUUID()).with(asAdmin(admin)).with(csrf())
                        .contentType("application/json").content("{\"status\":\"reviewed\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/reports").param("status", "weird").with(asAdmin(admin))).andExpect(status().isBadRequest());
    }

    @Test
    void regularUsersCannotSeeReports() throws Exception {
        api.get(lucas, "/api/admin/reports").andExpect(status().isForbidden());
    }
}
