package com.tennotalk.users;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** LGPD: the person gets everything stored about them, and nothing about others' private data. */
class DataExportIT extends IntegrationTest {

    @Test
    void exportsTheWholeAccountAsADownload() throws Exception {
        UUID lucas = data.user("lucas", "pt-BR");
        UUID cam = data.user("cam", "vi-VN");
        data.setLearning(lucas, List.of("vi-VN"));
        data.password(lucas, "$argon2id$secret-hash");
        data.follow(lucas, cam);
        data.follow(cam, lucas);
        UUID conversation = steps.direct(lucas, cam);
        steps.send(lucas, conversation, "Oi, Cam!");
        steps.send(cam, conversation, "Chào anh — private to Cam");
        String post = api.postOk(lucas, "/api/posts", Map.of("mediaIds", List.of(data.media(lucas, "image")), "caption", "Praia"))
                .get("id").asString();
        api.postOk(lucas, "/api/posts/" + post + "/comments", Map.of("text", "Linda!"));
        api.postOk(lucas, "/api/reports", Map.of("targetKind", "user", "targetId", cam, "reason", "spam"));

        var response = api.get(lucas, "/api/me/export")
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"tenno-talk-data.json\""))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse();
        String raw = response.getContentAsString();
        JsonNode export = json.readTree(raw);

        assertThat(export.get("format").asString()).isEqualTo("tenno-talk-export/1");
        assertThat(export.at("/account/username").asString()).isEqualTo("lucas");
        assertThat(export.at("/account/learning_languages/0").asString()).isEqualTo("vi-VN");
        assertThat(export.at("/preferences/receiving_language").asString()).isEqualTo("pt-BR");
        assertThat(export.at("/termsAcceptances/0/terms_version").asString()).isNotBlank();
        assertThat(export.at("/following/0/username").asString()).isEqualTo("cam");
        assertThat(export.at("/followers/0/username").asString()).isEqualTo("cam");
        assertThat(export.at("/conversations/0/members").size()).isEqualTo(2);
        assertThat(export.get("messagesSent").size()).isOne();
        assertThat(export.at("/messagesSent/0/original_text").asString()).isEqualTo("Oi, Cam!");
        assertThat(export.at("/posts/0/caption_text").asString()).isEqualTo("Praia");
        assertThat(export.at("/comments/0/body_text").asString()).isEqualTo("Linda!");
        assertThat(export.get("media").size()).isOne();
        assertThat(export.at("/reportsFiled/0/reason").asString()).isEqualTo("spam");

        assertThat(raw).doesNotContain("argon2").doesNotContain("password").doesNotContain("private to Cam");
    }

    @Test
    void anEmptyAccountExportsEmptySections() throws Exception {
        UUID lucas = data.user("lucas", "pt-BR");
        JsonNode export = api.getOk(lucas, "/api/me/export");
        assertThat(export.get("messagesSent").isArray()).isTrue();
        assertThat(export.get("messagesSent").size()).isZero();
        assertThat(export.get("linkedAccounts").size()).isZero();
    }
}
