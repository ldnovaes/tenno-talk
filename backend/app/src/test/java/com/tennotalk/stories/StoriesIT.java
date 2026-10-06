package com.tennotalk.stories;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StoriesIT extends IntegrationTest {

    private UUID rafael;
    private UUID linh;
    private UUID ana;

    @BeforeEach
    void people() {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
        ana = data.user("ana", "es-ES");
    }

    private String story(UUID author, String text) throws Exception {
        Map<String, Object> body = text == null
                ? Map.of("mediaId", data.media(author, "image"))
                : Map.of("mediaId", data.media(author, "image"), "text", text);
        return api.postOk(author, "/api/stories", body).get("id").asString();
    }

    private void expire(String storyId) {
        jdbc.sql("UPDATE stories SET expires_at = :at WHERE id = :id")
                .param("at", Timestamp.from(Instant.now().minusSeconds(1))).param("id", UUID.fromString(storyId)).update();
    }

    // ---- creating ----------------------------------------------------------

    @Test
    void createsAStoryThatLivesTwentyFourHours() throws Exception {
        JsonNode created = api.postOk(rafael, "/api/stories", Map.of("mediaId", data.media(rafael, "image"), "text", " Bom dia! "));
        assertThat(created.at("/overlayText/text").asString()).isEqualTo("Bom dia!");
        assertThat(created.at("/overlayText/language").asString()).isEqualTo("pt-BR");
        assertThat(created.at("/overlayTranslation/status").asString()).isEqualTo("not_needed");
        assertThat(created.at("/media/kind").asString()).isEqualTo("image");
        assertThat(created.get("viewedByMe").asBoolean()).isTrue();
        Instant createdAt = Instant.parse(created.get("createdAt").asString());
        Instant expiresAt = Instant.parse(created.get("expiresAt").asString());
        assertThat(java.time.Duration.between(createdAt, expiresAt)).isEqualTo(java.time.Duration.ofHours(24));
    }

    @Test
    void storiesWithoutTextHaveNoOverlay() throws Exception {
        JsonNode created = api.postOk(rafael, "/api/stories", Map.of("mediaId", data.media(rafael, "video")));
        assertThat(created.get("overlayText").isNull()).isTrue();
        assertThat(created.get("overlayTranslation").isNull()).isTrue();
    }

    @Test
    void storiesAcceptOnlyYourOwnPhotosAndVideos() throws Exception {
        api.post(rafael, "/api/stories", Map.of("mediaId", data.media(linh, "image"))).andExpect(status().isBadRequest());
        api.post(rafael, "/api/stories", Map.of("mediaId", data.media(rafael, "file"))).andExpect(status().isBadRequest());
        api.post(rafael, "/api/stories", Map.of("mediaId", UUID.randomUUID())).andExpect(status().isBadRequest());
        api.post(rafael, "/api/stories", Map.of()).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.mediaId").exists());
    }

    @Test
    void storyTextHasALimit() throws Exception {
        api.post(rafael, "/api/stories", Map.of("mediaId", data.media(rafael, "image"), "text", "a".repeat(251)))
                .andExpect(status().isBadRequest());
    }

    // ---- tray --------------------------------------------------------------

    @Test
    void trayShowsMeFirstThenUnseenThenSeen() throws Exception {
        data.follow(rafael, linh);
        data.follow(rafael, ana);
        String linhStory = story(linh, "Chào");
        story(ana, "Hola");
        story(rafael, "Oi");
        api.put(rafael, "/api/stories/" + linhStory + "/view").andExpect(status().isNoContent());

        JsonNode tray = api.getOk(rafael, "/api/stories/tray");
        assertThat(tray.size()).isEqualTo(3);
        assertThat(tray.at("/0/user/username").asString()).isEqualTo("rafael");
        assertThat(tray.at("/0/hasUnseen").asBoolean()).isFalse();
        assertThat(tray.at("/1/user/username").asString()).isEqualTo("ana");
        assertThat(tray.at("/1/hasUnseen").asBoolean()).isTrue();
        assertThat(tray.at("/2/user/username").asString()).isEqualTo("linh");
        assertThat(tray.at("/2/hasUnseen").asBoolean()).isFalse();
        assertThat(tray.at("/2/stories/0/viewedByMe").asBoolean()).isTrue();
    }

    @Test
    void storiesOfOneAuthorAreGroupedOldestFirst() throws Exception {
        data.follow(rafael, linh);
        String first = story(linh, "1");
        String second = story(linh, "2");
        JsonNode tray = api.getOk(rafael, "/api/stories/tray");
        assertThat(tray.size()).isOne();
        assertThat(tray.at("/0/stories/0/id").asString()).isEqualTo(first);
        assertThat(tray.at("/0/stories/1/id").asString()).isEqualTo(second);
        api.put(rafael, "/api/stories/" + first + "/view");
        assertThat(api.getOk(rafael, "/api/stories/tray").at("/0/hasUnseen").asBoolean()).isTrue();
    }

    @Test
    void viewingTwiceIsHarmless() throws Exception {
        String id = story(linh, "Chào");
        api.put(rafael, "/api/stories/" + id + "/view").andExpect(status().isNoContent());
        api.put(rafael, "/api/stories/" + id + "/view").andExpect(status().isNoContent());
        assertThat(jdbc.sql("SELECT count(*) FROM story_views").query(Long.class).single()).isOne();
    }

    @Test
    void expiredStoriesDisappear() throws Exception {
        String id = story(linh, "Chào");
        expire(id);
        assertThat(api.getOk(rafael, "/api/stories/tray").size()).isZero();
        api.put(rafael, "/api/stories/" + id + "/view").andExpect(status().isNotFound());
        api.post(rafael, "/api/stories/" + id + "/reactions", Map.of("emoji", "❤️")).andExpect(status().isNotFound());
        api.post(rafael, "/api/stories/" + id + "/replies", Map.of("text", "oi")).andExpect(status().isNotFound());
    }

    @Test
    void blockedAndPrivateAuthorsAreHidden() throws Exception {
        story(linh, "Chào");
        story(ana, "Hola");
        data.block(linh, rafael);
        data.setPreference(ana, "profile_visibility", "private");
        assertThat(api.getOk(rafael, "/api/stories/tray").size()).isZero();

        data.follow(rafael, ana);
        assertThat(api.getOk(rafael, "/api/stories/tray").at("/0/user/username").asString()).isEqualTo("ana");
    }

    @Test
    void pendingFollowRequestDoesNotRevealPrivateStories() throws Exception {
        String id = story(ana, "private story");
        data.setPreference(ana, "profile_visibility", "private");

        api.put(rafael, "/api/profiles/" + ana + "/follow").andExpect(status().isOk())
                .andExpect(jsonPath("$.followRequestPending").value(true));
        assertThat(api.getOk(rafael, "/api/stories/tray").size()).isZero();
        api.get(rafael, "/api/stories/" + id).andExpect(status().isNotFound());

        api.post(ana, "/api/me/follow-requests/" + rafael + "/approve", null).andExpect(status().isNoContent());
        api.get(rafael, "/api/stories/" + id).andExpect(status().isOk());
    }

    // ---- reactions and replies --------------------------------------------

    @Test
    void reactionsNeedAnEmoji() throws Exception {
        String id = story(linh, "Chào");
        api.post(rafael, "/api/stories/" + id + "/reactions", Map.of("emoji", " ")).andExpect(status().isBadRequest());
    }

    @Test
    void replyingSendsADirectMessageThatReferencesTheStory() throws Exception {
        String id = story(linh, "Chào buổi sáng");
        JsonNode reply = api.postOk(rafael, "/api/stories/" + id + "/replies", Map.of("clientId", "r-1", "text", "Que lindo!"));
        UUID conversation = UUID.fromString(reply.get("conversationId").asString());

        JsonNode message = steps.lastMessage(linh, conversation);
        assertThat(message.at("/content/body/text").asString()).isEqualTo("Que lindo!");
        assertThat(message.at("/senderId").asString()).isEqualTo(rafael.toString());
        assertThat(jdbc.sql("SELECT story_id FROM messages").query(UUID.class).single()).isEqualTo(UUID.fromString(id));
        assertThat(jdbc.sql("SELECT type FROM messages").query(String.class).single()).isEqualTo("story_reply");

        // The same clientId does not send twice (retries after a network error).
        api.postOk(rafael, "/api/stories/" + id + "/replies", Map.of("clientId", "r-1", "text", "Que lindo!"));
        assertThat(jdbc.sql("SELECT count(*) FROM messages").query(Long.class).single()).isOne();
    }

    @Test
    void repliesReuseTheExistingConversation() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        String id = story(linh, "Chào");
        JsonNode reply = api.postOk(rafael, "/api/stories/" + id + "/replies", Map.of("text", "oi"));
        assertThat(reply.get("conversationId").asString()).isEqualTo(conversation.toString());
    }

    @Test
    void repliesAreTranslatedLikeAnyMessage() throws Exception {
        String id = story(linh, "Chào");
        api.postOk(rafael, "/api/stories/" + id + "/replies", Map.of("text", "Que lindo!"));
        assertThat(jdbc.sql("SELECT target_language FROM translation_jobs").query(String.class).single()).isEqualTo("vi-VN");
    }

    @Test
    void repliesRespectWhoCanMessage() throws Exception {
        String id = story(linh, "Chào");
        data.setPreference(linh, "who_can_message", "nobody");
        api.post(rafael, "/api/stories/" + id + "/replies", Map.of("text", "oi")).andExpect(status().isForbidden());
    }

    @Test
    void youCannotReplyToYourOwnStory() throws Exception {
        String id = story(linh, "Chào");
        api.post(linh, "/api/stories/" + id + "/replies", Map.of("text", "oi")).andExpect(status().isBadRequest());
    }

    @Test
    void emptyRepliesAreRejected() throws Exception {
        String id = story(linh, "Chào");
        api.post(rafael, "/api/stories/" + id + "/replies", Map.of("text", "  ")).andExpect(status().isBadRequest());
    }

    // ---- translation -------------------------------------------------------

    @Test
    void overlayTextIsTranslatedOnDemand() throws Exception {
        data.follow(rafael, linh);
        String id = story(linh, "Chào buổi sáng");
        assertThat(api.getOk(rafael, "/api/stories/tray").at("/0/stories/0/overlayTranslation").isNull()).isTrue();
        JsonNode translated = api.postOk(rafael, "/api/translations/story/" + id + "?lang=pt-BR", null);
        assertThat(translated.get("text").asString()).isEqualTo("[Portuguese (Brazil)] Chào buổi sáng");
        assertThat(api.getOk(rafael, "/api/stories/tray").at("/0/stories/0/overlayTranslation/status").asString())
                .isEqualTo("translated");
    }

    @Test
    void expiredStoriesCannotBeTranslated() throws Exception {
        String id = story(linh, "Chào");
        expire(id);
        api.post(rafael, "/api/translations/story/" + id + "?lang=pt-BR", null).andExpect(status().isNotFound());
    }
}
