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

    private UUID lucas;
    private UUID cam;

    @BeforeEach
    void people() {
        lucas = data.user("lucas", "pt-BR");
        cam = data.user("cam", "vi-VN");
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
        api.put(cam, "/api/profiles/" + lucas + "/follow").andExpect(status().isOk());
        JsonNode list = api.getOk(lucas, "/api/notifications");
        assertThat(list.size()).isOne();
        assertThat(list.at("/0/type").asString()).isEqualTo("follow");
        assertThat(list.at("/0/actor/username").asString()).isEqualTo("cam");
        assertThat(list.at("/0/readAt").isNull()).isTrue();
        assertThat(list.get(0).has("postId")).isFalse();
        assertThat(unread(lucas)).isOne();
    }

    @Test
    void followingTwiceNotifiesOnce() throws Exception {
        api.put(cam, "/api/profiles/" + lucas + "/follow");
        api.put(cam, "/api/profiles/" + lucas + "/follow");
        assertThat(api.getOk(lucas, "/api/notifications").size()).isOne();
    }

    @Test
    void notificationsAreNewestFirstWithTheirTargets() throws Exception {
        String post = post(lucas);
        api.put(cam, "/api/posts/" + post + "/like");
        String comment = api.postOk(cam, "/api/posts/" + post + "/comments", Map.of("text", "đẹp")).get("id").asString();

        JsonNode list = api.getOk(lucas, "/api/notifications");
        assertThat(list.size()).isEqualTo(2);
        assertThat(list.at("/0/type").asString()).isEqualTo("comment");
        assertThat(list.at("/0/postId").asString()).isEqualTo(post);
        assertThat(list.at("/0/commentId").asString()).isEqualTo(comment);
        assertThat(list.at("/1/type").asString()).isEqualTo("like");
        assertThat(list.at("/1/postId").asString()).isEqualTo(post);
    }

    @Test
    void readAllClearsTheBadge() throws Exception {
        api.put(cam, "/api/profiles/" + lucas + "/follow");
        assertThat(unread(lucas)).isOne();
        api.post(lucas, "/api/notifications/read-all", null).andExpect(status().isNoContent());
        assertThat(unread(lucas)).isZero();
        assertThat(api.getOk(lucas, "/api/notifications").at("/0/readAt").isNull()).isFalse();
    }

    @Test
    void notificationsArePrivate() throws Exception {
        api.put(cam, "/api/profiles/" + lucas + "/follow");
        assertThat(api.getOk(cam, "/api/notifications").size()).isZero();
        api.post(cam, "/api/notifications/read-all", null);
        assertThat(unread(lucas)).isOne();
    }

    @Test
    void eachTypeHonorsItsPreference() throws Exception {
        data.setPreference(lucas, "notify_followers", false);
        data.setPreference(lucas, "notify_comments", false);
        String post = post(lucas);
        api.put(cam, "/api/profiles/" + lucas + "/follow");
        api.postOk(cam, "/api/posts/" + post + "/comments", Map.of("text", "oi"));
        api.put(cam, "/api/posts/" + post + "/like");
        JsonNode list = api.getOk(lucas, "/api/notifications");
        assertThat(list.size()).isOne();
        assertThat(list.at("/0/type").asString()).isEqualTo("like");
    }

    @Test
    void blockedActorsDisappearFromTheList() throws Exception {
        api.put(cam, "/api/profiles/" + lucas + "/follow");
        data.block(lucas, cam);
        assertThat(api.getOk(lucas, "/api/notifications").size()).isZero();
        assertThat(unread(lucas)).isZero();
    }

    @Test
    void nobodyIsNotifiedAboutTheirOwnActions() throws Exception {
        String post = post(lucas);
        api.put(lucas, "/api/posts/" + post + "/like");
        api.postOk(lucas, "/api/posts/" + post + "/comments", Map.of("text", "eu"));
        assertThat(api.getOk(lucas, "/api/notifications").size()).isZero();
    }
}
