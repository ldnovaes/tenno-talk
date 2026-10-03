package com.tennotalk.feed;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class FeedIT extends IntegrationTest {

    private UUID lucas;
    private UUID cam;

    @BeforeEach
    void people() {
        lucas = data.user("lucas", "pt-BR");
        cam = data.user("cam", "vi-VN");
    }

    private JsonNode post(UUID author, String caption) throws Exception {
        return api.postOk(author, "/api/posts", Map.of("mediaIds", List.of(data.media(author, "image")), "caption", caption));
    }

    private long notifications(UUID user, String type) {
        return jdbc.sql("SELECT count(*) FROM notifications WHERE recipient_id = :u AND type = :t")
                .param("u", user).param("t", type).query(Long.class).single();
    }

    // ---- creating ----------------------------------------------------------

    @Test
    void createsAPostWithMediaInOrderAndACaptionInTheAuthorsLanguage() throws Exception {
        UUID first = data.media(lucas, "image");
        UUID second = data.media(lucas, "video");
        JsonNode created = api.postOk(lucas, "/api/posts", Map.of("mediaIds", List.of(first, second), "caption", "  Pôr do sol  "));
        assertThat(created.at("/author/username").asString()).isEqualTo("lucas");
        assertThat(created.at("/media/0/id").asString()).isEqualTo(first.toString());
        assertThat(created.at("/media/1/kind").asString()).isEqualTo("video");
        assertThat(created.at("/media/0/url").asString()).isEqualTo("/api/media/" + first);
        assertThat(created.at("/caption/text").asString()).isEqualTo("Pôr do sol");
        assertThat(created.at("/caption/language").asString()).isEqualTo("pt-BR");
        assertThat(created.at("/captionTranslation/status").asString()).isEqualTo("not_needed");
        assertThat(created.at("/likesCount").asLong()).isZero();
        assertThat(created.at("/likedByMe").asBoolean()).isFalse();
    }

    @Test
    void aPostWithoutCaptionHasNoTranslation() throws Exception {
        JsonNode created = api.postOk(lucas, "/api/posts", Map.of("mediaIds", List.of(data.media(lucas, "image")), "caption", "   "));
        assertThat(created.get("caption").isNull()).isTrue();
        assertThat(created.get("captionTranslation").isNull()).isTrue();
    }

    @Test
    void aPostNeedsMedia() throws Exception {
        api.post(lucas, "/api/posts", Map.of("mediaIds", List.of(), "caption", "hi"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("validation"));
    }

    @Test
    void aPostCannotUseSomeoneElsesMedia() throws Exception {
        api.post(lucas, "/api/posts", Map.of("mediaIds", List.of(data.media(cam, "image"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aPostAcceptsOnlyPhotosAndVideos() throws Exception {
        api.post(lucas, "/api/posts", Map.of("mediaIds", List.of(data.media(lucas, "file"))))
                .andExpect(status().isBadRequest());
        api.post(lucas, "/api/posts", Map.of("mediaIds", List.of(data.media(lucas, "audio"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aPostHasAtMostTenItems() throws Exception {
        List<UUID> media = new ArrayList<>();
        for (int i = 0; i < 11; i++) media.add(data.media(lucas, "image"));
        api.post(lucas, "/api/posts", Map.of("mediaIds", media)).andExpect(status().isBadRequest());
    }

    @Test
    void duplicatedMediaIdsAreCollapsed() throws Exception {
        UUID image = data.media(lucas, "image");
        JsonNode created = api.postOk(lucas, "/api/posts", Map.of("mediaIds", List.of(image, image)));
        assertThat(created.get("media").size()).isOne();
    }

    @Test
    void captionsHaveALimit() throws Exception {
        api.post(lucas, "/api/posts", Map.of("mediaIds", List.of(data.media(lucas, "image")), "caption", "a".repeat(2201)))
                .andExpect(status().isBadRequest());
    }

    // ---- reading -----------------------------------------------------------

    @Test
    void feedIsNewestFirstAndPaginatesWithACursor() throws Exception {
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            String id = post(lucas, "post " + i).get("id").asString();
            data.setCreatedAt("posts", UUID.fromString(id), Instant.parse("2026-10-01T10:00:00Z").plusSeconds(i));
            ids.add(id);
        }
        JsonNode first = api.getOk(cam, "/api/feed");
        assertThat(first.get("items").size()).isEqualTo(10);
        assertThat(first.at("/items/0/id").asString()).isEqualTo(ids.get(11));
        assertThat(first.get("nextCursor").isNull()).isFalse();

        JsonNode second = api.getOk(cam, "/api/feed?cursor=" + first.get("nextCursor").asString());
        assertThat(second.get("items").size()).isEqualTo(2);
        assertThat(second.at("/items/1/id").asString()).isEqualTo(ids.get(0));
        assertThat(second.get("nextCursor").isNull()).isTrue();
    }

    @Test
    void aBrokenCursorIsAValidationError() throws Exception {
        api.get(cam, "/api/feed?cursor=%%%").andExpect(status().isBadRequest());
    }

    @Test
    void profilePostsListOnlyThatAuthor() throws Exception {
        post(lucas, "mine");
        post(cam, "hers");
        JsonNode page = api.getOk(cam, "/api/users/" + lucas + "/posts");
        assertThat(page.get("items").size()).isOne();
        assertThat(page.at("/items/0/author/id").asString()).isEqualTo(lucas.toString());
    }

    @Test
    void privateProfilesShowPostsOnlyToFollowers() throws Exception {
        String id = post(lucas, "secret").get("id").asString();
        data.setPreference(lucas, "profile_visibility", "private");

        assertThat(api.getOk(cam, "/api/feed").get("items").size()).isZero();
        api.get(cam, "/api/posts/" + id).andExpect(status().isNotFound());
        api.get(cam, "/api/posts/" + id + "/comments").andExpect(status().isNotFound());

        data.follow(cam, lucas);
        assertThat(api.getOk(cam, "/api/feed").get("items").size()).isOne();
        api.get(cam, "/api/posts/" + id).andExpect(status().isOk());
    }

    @Test
    void authorsAlwaysSeeTheirOwnPrivatePosts() throws Exception {
        post(lucas, "secret");
        data.setPreference(lucas, "profile_visibility", "private");
        assertThat(api.getOk(lucas, "/api/feed").get("items").size()).isOne();
    }

    @Test
    void blockingHidesPostsBothWays() throws Exception {
        String id = post(lucas, "hello").get("id").asString();
        data.block(lucas, cam);
        assertThat(api.getOk(cam, "/api/feed").get("items").size()).isZero();
        api.get(cam, "/api/posts/" + id).andExpect(status().isNotFound());
        api.put(cam, "/api/posts/" + id + "/like").andExpect(status().isNotFound());

        post(cam, "mine");
        assertThat(api.getOk(lucas, "/api/feed").get("items").size()).isOne();
    }

    @Test
    void unknownPostsAreNotFound() throws Exception {
        api.get(cam, "/api/posts/" + UUID.randomUUID()).andExpect(status().isNotFound());
    }

    @Test
    void malformedIdsAreNotFound() throws Exception {
        api.get(cam, "/api/posts/not-a-uuid").andExpect(status().isNotFound());
    }

    // ---- likes -------------------------------------------------------------

    @Test
    void likingIsIdempotentAndNotifiesTheAuthorOnce() throws Exception {
        String id = post(lucas, "hi").get("id").asString();
        JsonNode liked = api.ok(api.put(cam, "/api/posts/" + id + "/like"));
        assertThat(liked.get("likesCount").asLong()).isOne();
        assertThat(liked.get("likedByMe").asBoolean()).isTrue();
        api.ok(api.put(cam, "/api/posts/" + id + "/like"));
        assertThat(api.getOk(cam, "/api/posts/" + id).get("likesCount").asLong()).isOne();
        assertThat(notifications(lucas, "like")).isOne();
        assertThat(api.getOk(lucas, "/api/posts/" + id).get("likedByMe").asBoolean()).isFalse();
    }

    @Test
    void unlikingRemovesTheLike() throws Exception {
        String id = post(lucas, "hi").get("id").asString();
        api.put(cam, "/api/posts/" + id + "/like");
        JsonNode unliked = api.ok(api.delete(cam, "/api/posts/" + id + "/like"));
        assertThat(unliked.get("likesCount").asLong()).isZero();
        assertThat(unliked.get("likedByMe").asBoolean()).isFalse();
        api.ok(api.delete(cam, "/api/posts/" + id + "/like"));
    }

    @Test
    void likingYourOwnPostDoesNotNotify() throws Exception {
        String id = post(lucas, "hi").get("id").asString();
        api.ok(api.put(lucas, "/api/posts/" + id + "/like"));
        assertThat(notifications(lucas, "like")).isZero();
    }

    @Test
    void likeNotificationsRespectThePreference() throws Exception {
        String id = post(lucas, "hi").get("id").asString();
        data.setPreference(lucas, "notify_likes", false);
        api.ok(api.put(cam, "/api/posts/" + id + "/like"));
        assertThat(notifications(lucas, "like")).isZero();
    }

    // ---- comments ----------------------------------------------------------

    @Test
    void commentsAreListedOldestFirstAndCounted() throws Exception {
        String id = post(lucas, "hi").get("id").asString();
        JsonNode first = api.postOk(cam, "/api/posts/" + id + "/comments", Map.of("text", " Đẹp quá! "));
        assertThat(first.at("/body/text").asString()).isEqualTo("Đẹp quá!");
        assertThat(first.at("/body/language").asString()).isEqualTo("vi-VN");
        assertThat(first.at("/author/username").asString()).isEqualTo("cam");
        api.postOk(lucas, "/api/posts/" + id + "/comments", Map.of("text", "Obrigado!"));

        JsonNode comments = api.getOk(lucas, "/api/posts/" + id + "/comments");
        assertThat(comments.size()).isEqualTo(2);
        assertThat(comments.at("/0/body/text").asString()).isEqualTo("Đẹp quá!");
        assertThat(comments.at("/0/translation").isNull()).isTrue();
        assertThat(comments.at("/1/translation/status").asString()).isEqualTo("not_needed");
        assertThat(api.getOk(cam, "/api/posts/" + id).get("commentsCount").asLong()).isEqualTo(2);
        assertThat(notifications(lucas, "comment")).isOne();
    }

    @Test
    void emptyAndHugeCommentsAreRejected() throws Exception {
        String id = post(lucas, "hi").get("id").asString();
        api.post(cam, "/api/posts/" + id + "/comments", Map.of("text", "   ")).andExpect(status().isBadRequest());
        api.post(cam, "/api/posts/" + id + "/comments", Map.of("text", "a".repeat(2001))).andExpect(status().isBadRequest());
    }

    @Test
    void whoCanCommentIsEnforcedByTheServer() throws Exception {
        String id = post(lucas, "hi").get("id").asString();
        data.setPreference(lucas, "who_can_comment", "nobody");
        api.post(cam, "/api/posts/" + id + "/comments", Map.of("text", "oi")).andExpect(status().isForbidden());
        api.postOk(lucas, "/api/posts/" + id + "/comments", Map.of("text", "the author always can"));
    }

    @Test
    void followersMeansPeopleTheAuthorFollows() throws Exception {
        // "People I follow": following the author is not enough, otherwise anyone could opt in.
        String id = post(lucas, "hi").get("id").asString();
        data.setPreference(lucas, "who_can_comment", "followers");
        data.follow(cam, lucas);
        api.post(cam, "/api/posts/" + id + "/comments", Map.of("text", "oi")).andExpect(status().isForbidden());
        data.follow(lucas, cam);
        api.post(cam, "/api/posts/" + id + "/comments", Map.of("text", "oi")).andExpect(status().isOk());
    }

    @Test
    void commentsFromBlockedPeopleAreHidden() throws Exception {
        UUID ana = data.user("ana", "es-ES");
        String id = post(lucas, "hi").get("id").asString();
        api.postOk(ana, "/api/posts/" + id + "/comments", Map.of("text", "hola"));
        data.block(cam, ana);
        assertThat(api.getOk(cam, "/api/posts/" + id + "/comments").size()).isZero();
        assertThat(api.getOk(lucas, "/api/posts/" + id + "/comments").size()).isOne();
    }

    // ---- translation of captions and comments --------------------------------

    @Test
    void captionsAreTranslatedOnDemandAndCached() throws Exception {
        String id = post(lucas, "Pôr do sol na praia").get("id").asString();
        assertThat(api.getOk(cam, "/api/posts/" + id).get("captionTranslation").isNull()).isTrue();

        JsonNode translated = api.postOk(cam, "/api/translations/post/" + id + "?lang=vi-VN", null);
        assertThat(translated.get("status").asString()).isEqualTo("translated");
        assertThat(translated.get("text").asString()).isEqualTo("[Vietnamese (Vietnam)] Pôr do sol na praia");

        JsonNode seen = api.getOk(cam, "/api/posts/" + id);
        assertThat(seen.at("/captionTranslation/text").asString()).isEqualTo("[Vietnamese (Vietnam)] Pôr do sol na praia");
        assertThat(seen.at("/caption/text").asString()).isEqualTo("Pôr do sol na praia");

        api.postOk(cam, "/api/translations/post/" + id + "?lang=vi-VN", null);
        assertThat(ai.translationCalls("codex")).isOne();
    }

    @Test
    void commentsAreTranslatedOnDemand() throws Exception {
        String id = post(lucas, "hi").get("id").asString();
        String comment = api.postOk(cam, "/api/posts/" + id + "/comments", Map.of("text", "Đẹp quá!")).get("id").asString();
        JsonNode translated = api.postOk(lucas, "/api/translations/comment/" + comment + "?lang=pt-BR", null);
        assertThat(translated.get("text").asString()).isEqualTo("[Portuguese (Brazil)] Đẹp quá!");
        assertThat(api.getOk(lucas, "/api/posts/" + id + "/comments").at("/0/translation/status").asString()).isEqualTo("translated");
    }

    @Test
    void hiddenContentCannotBeTranslated() throws Exception {
        String id = post(lucas, "segredo").get("id").asString();
        data.setPreference(lucas, "profile_visibility", "private");
        api.post(cam, "/api/translations/post/" + id + "?lang=vi-VN", null).andExpect(status().isNotFound());
        assertThat(ai.translationCalls("codex")).isZero();
    }

    @Test
    void aPostWithoutCaptionHasNothingToTranslate() throws Exception {
        String id = api.postOk(lucas, "/api/posts", Map.of("mediaIds", List.of(data.media(lucas, "image")))).get("id").asString();
        api.post(cam, "/api/translations/post/" + id + "?lang=vi-VN", null).andExpect(status().isNotFound());
    }

    @Test
    void whenProvidersAreDownTheCaptionWaitsInTheQueue() throws Exception {
        ai.mode("codex", com.tennotalk.support.FakeProcessRunner.Mode.QUOTA);
        ai.mode("claude", com.tennotalk.support.FakeProcessRunner.Mode.QUOTA);
        String id = post(lucas, "Pôr do sol").get("id").asString();
        JsonNode pending = api.postOk(cam, "/api/translations/post/" + id + "?lang=vi-VN", null);
        assertThat(pending.get("status").asString()).isEqualTo("pending");
        assertThat(jdbc.sql("SELECT count(*) FROM translation_jobs WHERE kind = 'post'").query(Long.class).single()).isOne();
    }
}
