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

    private UUID rafael;
    private UUID linh;

    @BeforeEach
    void people() {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
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
        UUID first = data.media(rafael, "image");
        UUID second = data.media(rafael, "video");
        JsonNode created = api.postOk(rafael, "/api/posts", Map.of("mediaIds", List.of(first, second), "caption", "  Pôr do sol  "));
        assertThat(created.at("/author/username").asString()).isEqualTo("rafael");
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
        JsonNode created = api.postOk(rafael, "/api/posts", Map.of("mediaIds", List.of(data.media(rafael, "image")), "caption", "   "));
        assertThat(created.get("caption").isNull()).isTrue();
        assertThat(created.get("captionTranslation").isNull()).isTrue();
    }

    @Test
    void aPostNeedsMedia() throws Exception {
        api.post(rafael, "/api/posts", Map.of("mediaIds", List.of(), "caption", "hi"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("validation"));
    }

    @Test
    void aPostCannotUseSomeoneElsesMedia() throws Exception {
        api.post(rafael, "/api/posts", Map.of("mediaIds", List.of(data.media(linh, "image"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aPostAcceptsOnlyPhotosAndVideos() throws Exception {
        api.post(rafael, "/api/posts", Map.of("mediaIds", List.of(data.media(rafael, "file"))))
                .andExpect(status().isBadRequest());
        api.post(rafael, "/api/posts", Map.of("mediaIds", List.of(data.media(rafael, "audio"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aPostHasAtMostTenItems() throws Exception {
        List<UUID> media = new ArrayList<>();
        for (int i = 0; i < 11; i++) media.add(data.media(rafael, "image"));
        api.post(rafael, "/api/posts", Map.of("mediaIds", media)).andExpect(status().isBadRequest());
    }

    @Test
    void duplicatedMediaIdsAreCollapsed() throws Exception {
        UUID image = data.media(rafael, "image");
        JsonNode created = api.postOk(rafael, "/api/posts", Map.of("mediaIds", List.of(image, image)));
        assertThat(created.get("media").size()).isOne();
    }

    @Test
    void captionsHaveALimit() throws Exception {
        api.post(rafael, "/api/posts", Map.of("mediaIds", List.of(data.media(rafael, "image")), "caption", "a".repeat(2201)))
                .andExpect(status().isBadRequest());
    }

    // ---- reading -----------------------------------------------------------

    @Test
    void feedIsNewestFirstAndPaginatesWithACursor() throws Exception {
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            String id = post(rafael, "post " + i).get("id").asString();
            data.setCreatedAt("posts", UUID.fromString(id), Instant.parse("2026-10-01T10:00:00Z").plusSeconds(i));
            ids.add(id);
        }
        JsonNode first = api.getOk(linh, "/api/feed");
        assertThat(first.get("items").size()).isEqualTo(10);
        assertThat(first.at("/items/0/id").asString()).isEqualTo(ids.get(11));
        assertThat(first.get("nextCursor").isNull()).isFalse();

        JsonNode second = api.getOk(linh, "/api/feed?cursor=" + first.get("nextCursor").asString());
        assertThat(second.get("items").size()).isEqualTo(2);
        assertThat(second.at("/items/1/id").asString()).isEqualTo(ids.get(0));
        assertThat(second.get("nextCursor").isNull()).isTrue();
    }

    @Test
    void aBrokenCursorIsAValidationError() throws Exception {
        api.get(linh, "/api/feed?cursor=%%%").andExpect(status().isBadRequest());
    }

    @Test
    void profilePostsListOnlyThatAuthor() throws Exception {
        post(rafael, "mine");
        post(linh, "hers");
        JsonNode page = api.getOk(linh, "/api/users/" + rafael + "/posts");
        assertThat(page.get("items").size()).isOne();
        assertThat(page.at("/items/0/author/id").asString()).isEqualTo(rafael.toString());
    }

    @Test
    void privateProfilesShowPostsOnlyToFollowers() throws Exception {
        String id = post(rafael, "secret").get("id").asString();
        data.setPreference(rafael, "profile_visibility", "private");

        assertThat(api.getOk(linh, "/api/feed").get("items").size()).isZero();
        api.get(linh, "/api/posts/" + id).andExpect(status().isNotFound());
        api.get(linh, "/api/posts/" + id + "/comments").andExpect(status().isNotFound());

        data.follow(linh, rafael);
        assertThat(api.getOk(linh, "/api/feed").get("items").size()).isOne();
        api.get(linh, "/api/posts/" + id).andExpect(status().isOk());
    }

    @Test
    void authorsAlwaysSeeTheirOwnPrivatePosts() throws Exception {
        post(rafael, "secret");
        data.setPreference(rafael, "profile_visibility", "private");
        assertThat(api.getOk(rafael, "/api/feed").get("items").size()).isOne();
    }

    @Test
    void blockingHidesPostsBothWays() throws Exception {
        String id = post(rafael, "hello").get("id").asString();
        data.block(rafael, linh);
        assertThat(api.getOk(linh, "/api/feed").get("items").size()).isZero();
        api.get(linh, "/api/posts/" + id).andExpect(status().isNotFound());
        api.put(linh, "/api/posts/" + id + "/like").andExpect(status().isNotFound());

        post(linh, "mine");
        assertThat(api.getOk(rafael, "/api/feed").get("items").size()).isOne();
    }

    @Test
    void unknownPostsAreNotFound() throws Exception {
        api.get(linh, "/api/posts/" + UUID.randomUUID()).andExpect(status().isNotFound());
    }

    @Test
    void malformedIdsAreNotFound() throws Exception {
        api.get(linh, "/api/posts/not-a-uuid").andExpect(status().isNotFound());
    }

    // ---- likes -------------------------------------------------------------

    @Test
    void likingIsIdempotentAndNotifiesTheAuthorOnce() throws Exception {
        String id = post(rafael, "hi").get("id").asString();
        JsonNode liked = api.ok(api.put(linh, "/api/posts/" + id + "/like"));
        assertThat(liked.get("likesCount").asLong()).isOne();
        assertThat(liked.get("likedByMe").asBoolean()).isTrue();
        api.ok(api.put(linh, "/api/posts/" + id + "/like"));
        assertThat(api.getOk(linh, "/api/posts/" + id).get("likesCount").asLong()).isOne();
        assertThat(notifications(rafael, "like")).isOne();
        assertThat(api.getOk(rafael, "/api/posts/" + id).get("likedByMe").asBoolean()).isFalse();
    }

    @Test
    void unlikingRemovesTheLike() throws Exception {
        String id = post(rafael, "hi").get("id").asString();
        api.put(linh, "/api/posts/" + id + "/like");
        JsonNode unliked = api.ok(api.delete(linh, "/api/posts/" + id + "/like"));
        assertThat(unliked.get("likesCount").asLong()).isZero();
        assertThat(unliked.get("likedByMe").asBoolean()).isFalse();
        api.ok(api.delete(linh, "/api/posts/" + id + "/like"));
    }

    @Test
    void likingYourOwnPostDoesNotNotify() throws Exception {
        String id = post(rafael, "hi").get("id").asString();
        api.ok(api.put(rafael, "/api/posts/" + id + "/like"));
        assertThat(notifications(rafael, "like")).isZero();
    }

    @Test
    void likeNotificationsRespectThePreference() throws Exception {
        String id = post(rafael, "hi").get("id").asString();
        data.setPreference(rafael, "notify_likes", false);
        api.ok(api.put(linh, "/api/posts/" + id + "/like"));
        assertThat(notifications(rafael, "like")).isZero();
    }

    // ---- comments ----------------------------------------------------------

    @Test
    void commentsAreListedOldestFirstAndCounted() throws Exception {
        String id = post(rafael, "hi").get("id").asString();
        JsonNode first = api.postOk(linh, "/api/posts/" + id + "/comments", Map.of("text", " Đẹp quá! "));
        assertThat(first.at("/body/text").asString()).isEqualTo("Đẹp quá!");
        assertThat(first.at("/body/language").asString()).isEqualTo("vi-VN");
        assertThat(first.at("/author/username").asString()).isEqualTo("linh");
        api.postOk(rafael, "/api/posts/" + id + "/comments", Map.of("text", "Obrigado!"));

        JsonNode comments = api.getOk(rafael, "/api/posts/" + id + "/comments");
        assertThat(comments.size()).isEqualTo(2);
        assertThat(comments.at("/0/body/text").asString()).isEqualTo("Đẹp quá!");
        assertThat(comments.at("/0/translation").isNull()).isTrue();
        assertThat(comments.at("/1/translation/status").asString()).isEqualTo("not_needed");
        assertThat(api.getOk(linh, "/api/posts/" + id).get("commentsCount").asLong()).isEqualTo(2);
        assertThat(notifications(rafael, "comment")).isOne();
    }

    @Test
    void emptyAndHugeCommentsAreRejected() throws Exception {
        String id = post(rafael, "hi").get("id").asString();
        api.post(linh, "/api/posts/" + id + "/comments", Map.of("text", "   ")).andExpect(status().isBadRequest());
        api.post(linh, "/api/posts/" + id + "/comments", Map.of("text", "a".repeat(2001))).andExpect(status().isBadRequest());
    }

    @Test
    void whoCanCommentIsEnforcedByTheServer() throws Exception {
        String id = post(rafael, "hi").get("id").asString();
        data.setPreference(rafael, "who_can_comment", "nobody");
        api.post(linh, "/api/posts/" + id + "/comments", Map.of("text", "oi")).andExpect(status().isForbidden());
        api.postOk(rafael, "/api/posts/" + id + "/comments", Map.of("text", "the author always can"));
    }

    @Test
    void followersMeansPeopleTheAuthorFollows() throws Exception {
        // "People I follow": following the author is not enough, otherwise anyone could opt in.
        String id = post(rafael, "hi").get("id").asString();
        data.setPreference(rafael, "who_can_comment", "followers");
        data.follow(linh, rafael);
        api.post(linh, "/api/posts/" + id + "/comments", Map.of("text", "oi")).andExpect(status().isForbidden());
        data.follow(rafael, linh);
        api.post(linh, "/api/posts/" + id + "/comments", Map.of("text", "oi")).andExpect(status().isOk());
    }

    @Test
    void commentsFromBlockedPeopleAreHidden() throws Exception {
        UUID ana = data.user("ana", "es-ES");
        String id = post(rafael, "hi").get("id").asString();
        api.postOk(ana, "/api/posts/" + id + "/comments", Map.of("text", "hola"));
        data.block(linh, ana);
        assertThat(api.getOk(linh, "/api/posts/" + id + "/comments").size()).isZero();
        assertThat(api.getOk(rafael, "/api/posts/" + id + "/comments").size()).isOne();
    }

    // ---- translation of captions and comments --------------------------------

    @Test
    void captionsAreTranslatedOnDemandAndCached() throws Exception {
        String id = post(rafael, "Pôr do sol na praia").get("id").asString();
        assertThat(api.getOk(linh, "/api/posts/" + id).get("captionTranslation").isNull()).isTrue();

        JsonNode translated = api.postOk(linh, "/api/translations/post/" + id + "?lang=vi-VN", null);
        assertThat(translated.get("status").asString()).isEqualTo("translated");
        assertThat(translated.get("text").asString()).isEqualTo("[Vietnamese (Vietnam)] Pôr do sol na praia");

        JsonNode seen = api.getOk(linh, "/api/posts/" + id);
        assertThat(seen.at("/captionTranslation/text").asString()).isEqualTo("[Vietnamese (Vietnam)] Pôr do sol na praia");
        assertThat(seen.at("/caption/text").asString()).isEqualTo("Pôr do sol na praia");

        api.postOk(linh, "/api/translations/post/" + id + "?lang=vi-VN", null);
        assertThat(ai.translationCalls("openai")).isOne();
    }

    @Test
    void commentsAreTranslatedOnDemand() throws Exception {
        String id = post(rafael, "hi").get("id").asString();
        String comment = api.postOk(linh, "/api/posts/" + id + "/comments", Map.of("text", "Đẹp quá!")).get("id").asString();
        JsonNode translated = api.postOk(rafael, "/api/translations/comment/" + comment + "?lang=pt-BR", null);
        assertThat(translated.get("text").asString()).isEqualTo("[Portuguese (Brazil)] Đẹp quá!");
        assertThat(api.getOk(rafael, "/api/posts/" + id + "/comments").at("/0/translation/status").asString()).isEqualTo("translated");
    }

    @Test
    void hiddenContentCannotBeTranslated() throws Exception {
        String id = post(rafael, "segredo").get("id").asString();
        data.setPreference(rafael, "profile_visibility", "private");
        api.post(linh, "/api/translations/post/" + id + "?lang=vi-VN", null).andExpect(status().isNotFound());
        assertThat(ai.translationCalls("openai")).isZero();
    }

    @Test
    void aPostWithoutCaptionHasNothingToTranslate() throws Exception {
        String id = api.postOk(rafael, "/api/posts", Map.of("mediaIds", List.of(data.media(rafael, "image")))).get("id").asString();
        api.post(linh, "/api/translations/post/" + id + "?lang=vi-VN", null).andExpect(status().isNotFound());
    }

    @Test
    void whenProvidersAreDownTheCaptionWaitsInTheQueue() throws Exception {
        ai.mode("openai", com.tennotalk.support.FakeTranslators.Mode.QUOTA);
        ai.mode("anthropic", com.tennotalk.support.FakeTranslators.Mode.QUOTA);
        String id = post(rafael, "Pôr do sol").get("id").asString();
        JsonNode pending = api.postOk(linh, "/api/translations/post/" + id + "?lang=vi-VN", null);
        assertThat(pending.get("status").asString()).isEqualTo("pending");
        assertThat(jdbc.sql("SELECT count(*) FROM translation_jobs WHERE kind = 'post'").query(Long.class).single()).isOne();
    }
}
