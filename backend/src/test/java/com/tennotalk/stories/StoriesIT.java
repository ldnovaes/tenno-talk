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

    private UUID lucas;
    private UUID cam;
    private UUID ana;

    @BeforeEach
    void people() {
        lucas = data.user("lucas", "pt-BR");
        cam = data.user("cam", "vi-VN");
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
        JsonNode created = api.postOk(lucas, "/api/stories", Map.of("mediaId", data.media(lucas, "image"), "text", " Bom dia! "));
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
        JsonNode created = api.postOk(lucas, "/api/stories", Map.of("mediaId", data.media(lucas, "video")));
        assertThat(created.get("overlayText").isNull()).isTrue();
        assertThat(created.get("overlayTranslation").isNull()).isTrue();
    }

    @Test
    void storiesAcceptOnlyYourOwnPhotosAndVideos() throws Exception {
        api.post(lucas, "/api/stories", Map.of("mediaId", data.media(cam, "image"))).andExpect(status().isBadRequest());
        api.post(lucas, "/api/stories", Map.of("mediaId", data.media(lucas, "file"))).andExpect(status().isBadRequest());
        api.post(lucas, "/api/stories", Map.of("mediaId", UUID.randomUUID())).andExpect(status().isBadRequest());
        api.post(lucas, "/api/stories", Map.of()).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.mediaId").exists());
    }

    @Test
    void storyTextHasALimit() throws Exception {
        api.post(lucas, "/api/stories", Map.of("mediaId", data.media(lucas, "image"), "text", "a".repeat(251)))
                .andExpect(status().isBadRequest());
    }

    // ---- tray --------------------------------------------------------------

    @Test
    void trayShowsMeFirstThenUnseenThenSeen() throws Exception {
        String camStory = story(cam, "Chào");
        story(ana, "Hola");
        story(lucas, "Oi");
        api.put(lucas, "/api/stories/" + camStory + "/view").andExpect(status().isNoContent());

        JsonNode tray = api.getOk(lucas, "/api/stories/tray");
        assertThat(tray.size()).isEqualTo(3);
        assertThat(tray.at("/0/user/username").asString()).isEqualTo("lucas");
        assertThat(tray.at("/0/hasUnseen").asBoolean()).isFalse();
        assertThat(tray.at("/1/user/username").asString()).isEqualTo("ana");
        assertThat(tray.at("/1/hasUnseen").asBoolean()).isTrue();
        assertThat(tray.at("/2/user/username").asString()).isEqualTo("cam");
        assertThat(tray.at("/2/hasUnseen").asBoolean()).isFalse();
        assertThat(tray.at("/2/stories/0/viewedByMe").asBoolean()).isTrue();
    }

    @Test
    void storiesOfOneAuthorAreGroupedOldestFirst() throws Exception {
        String first = story(cam, "1");
        String second = story(cam, "2");
        JsonNode tray = api.getOk(lucas, "/api/stories/tray");
        assertThat(tray.size()).isOne();
        assertThat(tray.at("/0/stories/0/id").asString()).isEqualTo(first);
        assertThat(tray.at("/0/stories/1/id").asString()).isEqualTo(second);
        api.put(lucas, "/api/stories/" + first + "/view");
        assertThat(api.getOk(lucas, "/api/stories/tray").at("/0/hasUnseen").asBoolean()).isTrue();
    }

    @Test
    void viewingTwiceIsHarmless() throws Exception {
        String id = story(cam, "Chào");
        api.put(lucas, "/api/stories/" + id + "/view").andExpect(status().isNoContent());
        api.put(lucas, "/api/stories/" + id + "/view").andExpect(status().isNoContent());
        assertThat(jdbc.sql("SELECT count(*) FROM story_views").query(Long.class).single()).isOne();
    }

    @Test
    void expiredStoriesDisappear() throws Exception {
        String id = story(cam, "Chào");
        expire(id);
        assertThat(api.getOk(lucas, "/api/stories/tray").size()).isZero();
        api.put(lucas, "/api/stories/" + id + "/view").andExpect(status().isNotFound());
        api.post(lucas, "/api/stories/" + id + "/reactions", Map.of("emoji", "❤️")).andExpect(status().isNotFound());
        api.post(lucas, "/api/stories/" + id + "/replies", Map.of("text", "oi")).andExpect(status().isNotFound());
    }

    @Test
    void blockedAndPrivateAuthorsAreHidden() throws Exception {
        story(cam, "Chào");
        story(ana, "Hola");
        data.block(cam, lucas);
        data.setPreference(ana, "profile_visibility", "private");
        assertThat(api.getOk(lucas, "/api/stories/tray").size()).isZero();

        data.follow(lucas, ana);
        assertThat(api.getOk(lucas, "/api/stories/tray").at("/0/user/username").asString()).isEqualTo("ana");
    }

    // ---- reactions and replies --------------------------------------------

    @Test
    void reactingNotifiesTheAuthorWithTheEmoji() throws Exception {
        String id = story(cam, "Chào");
        api.post(lucas, "/api/stories/" + id + "/reactions", Map.of("emoji", "🔥")).andExpect(status().isNoContent());
        JsonNode notifications = api.getOk(cam, "/api/notifications");
        assertThat(notifications.at("/0/type").asString()).isEqualTo("story_reaction");
        assertThat(notifications.at("/0/storyId").asString()).isEqualTo(id);
        assertThat(notifications.at("/0/emoji").asString()).isEqualTo("🔥");
        assertThat(notifications.at("/0/actor/username").asString()).isEqualTo("lucas");
    }

    @Test
    void reactionsNeedAnEmoji() throws Exception {
        String id = story(cam, "Chào");
        api.post(lucas, "/api/stories/" + id + "/reactions", Map.of("emoji", " ")).andExpect(status().isBadRequest());
    }

    @Test
    void replyingSendsADirectMessageThatReferencesTheStory() throws Exception {
        String id = story(cam, "Chào buổi sáng");
        JsonNode reply = api.postOk(lucas, "/api/stories/" + id + "/replies", Map.of("clientId", "r-1", "text", "Que lindo!"));
        UUID conversation = UUID.fromString(reply.get("conversationId").asString());

        JsonNode message = steps.lastMessage(cam, conversation);
        assertThat(message.at("/content/body/text").asString()).isEqualTo("Que lindo!");
        assertThat(message.at("/senderId").asString()).isEqualTo(lucas.toString());
        assertThat(jdbc.sql("SELECT story_id FROM messages").query(UUID.class).single()).isEqualTo(UUID.fromString(id));
        assertThat(jdbc.sql("SELECT type FROM messages").query(String.class).single()).isEqualTo("story_reply");

        // The same clientId does not send twice (retries after a network error).
        api.postOk(lucas, "/api/stories/" + id + "/replies", Map.of("clientId", "r-1", "text", "Que lindo!"));
        assertThat(jdbc.sql("SELECT count(*) FROM messages").query(Long.class).single()).isOne();
    }

    @Test
    void repliesReuseTheExistingConversation() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        String id = story(cam, "Chào");
        JsonNode reply = api.postOk(lucas, "/api/stories/" + id + "/replies", Map.of("text", "oi"));
        assertThat(reply.get("conversationId").asString()).isEqualTo(conversation.toString());
    }

    @Test
    void repliesAreTranslatedLikeAnyMessage() throws Exception {
        String id = story(cam, "Chào");
        api.postOk(lucas, "/api/stories/" + id + "/replies", Map.of("text", "Que lindo!"));
        assertThat(jdbc.sql("SELECT target_language FROM translation_jobs").query(String.class).single()).isEqualTo("vi-VN");
    }

    @Test
    void repliesRespectWhoCanMessage() throws Exception {
        String id = story(cam, "Chào");
        data.setPreference(cam, "who_can_message", "nobody");
        api.post(lucas, "/api/stories/" + id + "/replies", Map.of("text", "oi")).andExpect(status().isForbidden());
    }

    @Test
    void youCannotReplyToYourOwnStory() throws Exception {
        String id = story(cam, "Chào");
        api.post(cam, "/api/stories/" + id + "/replies", Map.of("text", "oi")).andExpect(status().isBadRequest());
    }

    @Test
    void emptyRepliesAreRejected() throws Exception {
        String id = story(cam, "Chào");
        api.post(lucas, "/api/stories/" + id + "/replies", Map.of("text", "  ")).andExpect(status().isBadRequest());
    }

    // ---- translation -------------------------------------------------------

    @Test
    void overlayTextIsTranslatedOnDemand() throws Exception {
        String id = story(cam, "Chào buổi sáng");
        assertThat(api.getOk(lucas, "/api/stories/tray").at("/0/stories/0/overlayTranslation").isNull()).isTrue();
        JsonNode translated = api.postOk(lucas, "/api/translations/story/" + id + "?lang=pt-BR", null);
        assertThat(translated.get("text").asString()).isEqualTo("[Portuguese (Brazil)] Chào buổi sáng");
        assertThat(api.getOk(lucas, "/api/stories/tray").at("/0/stories/0/overlayTranslation/status").asString())
                .isEqualTo("translated");
    }

    @Test
    void expiredStoriesCannotBeTranslated() throws Exception {
        String id = story(cam, "Chào");
        expire(id);
        api.post(lucas, "/api/translations/story/" + id + "?lang=pt-BR", null).andExpect(status().isNotFound());
    }
}
