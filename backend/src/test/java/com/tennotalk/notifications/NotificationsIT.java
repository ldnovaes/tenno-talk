package com.tennotalk.notifications;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NotificationsIT extends IntegrationTest {

    private UUID rafael;
    private UUID linh;

    @BeforeEach
    void people() {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
    }

    private long unread(UUID user) throws Exception {
        return api.getOk(user, "/api/notifications/unread-count").get("count").asLong();
    }

    private String post(UUID author) throws Exception {
        return api.postOk(author, "/api/posts", Map.of("mediaIds", List.of(data.media(author, "image")), "caption", "hi"))
                .get("id").asString();
    }

    @Test
    void followingNotifies() throws Exception {
        api.put(linh, "/api/profiles/" + rafael + "/follow").andExpect(status().isOk());
        JsonNode list = api.getOk(rafael, "/api/notifications");
        assertThat(list.size()).isOne();
        assertThat(list.at("/0/type").asString()).isEqualTo("follow");
        assertThat(list.at("/0/actor/username").asString()).isEqualTo("linh");
        assertThat(list.at("/0/readAt").isNull()).isTrue();
        assertThat(list.get(0).has("postId")).isFalse();
        assertThat(unread(rafael)).isOne();
    }

    @Test
    void followingTwiceNotifiesOnce() throws Exception {
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        assertThat(api.getOk(rafael, "/api/notifications").size()).isOne();
    }

    @Test
    void notificationsAreNewestFirstWithTheirTargets() throws Exception {
        String post = post(rafael);
        api.put(linh, "/api/posts/" + post + "/like");
        String comment = api.postOk(linh, "/api/posts/" + post + "/comments", Map.of("text", "đẹp")).get("id").asString();

        JsonNode list = api.getOk(rafael, "/api/notifications");
        assertThat(list.size()).isEqualTo(2);
        assertThat(list.at("/0/type").asString()).isEqualTo("comment");
        assertThat(list.at("/0/postId").asString()).isEqualTo(post);
        assertThat(list.at("/0/commentId").asString()).isEqualTo(comment);
        assertThat(list.at("/1/type").asString()).isEqualTo("like");
        assertThat(list.at("/1/postId").asString()).isEqualTo(post);
    }

    @Test
    void readAllClearsTheBadge() throws Exception {
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        assertThat(unread(rafael)).isOne();
        api.post(rafael, "/api/notifications/read-all", null).andExpect(status().isNoContent());
        assertThat(unread(rafael)).isZero();
        assertThat(api.getOk(rafael, "/api/notifications").at("/0/readAt").isNull()).isFalse();
    }

    @Test
    void notificationsArePrivate() throws Exception {
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        assertThat(api.getOk(linh, "/api/notifications").size()).isZero();
        api.post(linh, "/api/notifications/read-all", null);
        assertThat(unread(rafael)).isOne();
    }

    @Test
    void eachTypeHonorsItsPreference() throws Exception {
        data.setPreference(rafael, "notify_followers", false);
        data.setPreference(rafael, "notify_comments", false);
        String post = post(rafael);
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        api.postOk(linh, "/api/posts/" + post + "/comments", Map.of("text", "oi"));
        api.put(linh, "/api/posts/" + post + "/like");
        JsonNode list = api.getOk(rafael, "/api/notifications");
        assertThat(list.size()).isOne();
        assertThat(list.at("/0/type").asString()).isEqualTo("like");
    }

    @Test
    void blockedActorsDisappearFromTheList() throws Exception {
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        data.block(rafael, linh);
        assertThat(api.getOk(rafael, "/api/notifications").size()).isZero();
        assertThat(unread(rafael)).isZero();
    }

    @Test
    void nobodyIsNotifiedAboutTheirOwnActions() throws Exception {
        String post = post(rafael);
        api.put(rafael, "/api/posts/" + post + "/like");
        api.postOk(rafael, "/api/posts/" + post + "/comments", Map.of("text", "eu"));
        assertThat(api.getOk(rafael, "/api/notifications").size()).isZero();
    }
}
