package com.tennotalk.notifications;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static com.tennotalk.support.TestData.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
    void togglingALikeOrAFollowNotifiesOnceADay() throws Exception {
        String post = post(rafael);
        for (int i = 0; i < 3; i++) {
            api.put(linh, "/api/posts/" + post + "/like").andExpect(status().isOk());
            api.delete(linh, "/api/posts/" + post + "/like").andExpect(status().isOk());
            api.put(linh, "/api/profiles/" + rafael + "/follow").andExpect(status().isOk());
            api.delete(linh, "/api/profiles/" + rafael + "/follow");
        }
        JsonNode list = api.getOk(rafael, "/api/notifications");
        assertThat(list.size()).as("one like and one follow, not six").isEqualTo(2);
        assertThat(jdbc.sql("SELECT count(*) FROM push_jobs").query(Long.class).single()).isLessThanOrEqualTo(2);

        // A day later the same action notifies again; a like on another post is a new notification.
        jdbc.sql("UPDATE notifications SET created_at = now() - interval '25 hours'").update();
        api.put(linh, "/api/posts/" + post + "/like").andExpect(status().isOk());
        api.put(linh, "/api/posts/" + post(rafael) + "/like").andExpect(status().isOk());
        assertThat(api.getOk(rafael, "/api/notifications").size()).isEqualTo(4);
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

    private List<String> types(UUID user) throws Exception {
        return api.getOk(user, "/api/notifications").valueStream().map(n -> n.get("type").asString()).toList();
    }

    @Test
    void aFollowRequestNotifiesTheOwnerOnce() throws Exception {
        data.setPreference(rafael, "profile_visibility", "private");
        api.put(linh, "/api/profiles/" + rafael + "/follow").andExpect(status().isOk());
        api.put(linh, "/api/profiles/" + rafael + "/follow").andExpect(status().isOk());
        JsonNode list = api.getOk(rafael, "/api/notifications");
        assertThat(list.size()).isOne();
        assertThat(list.at("/0/type").asString()).isEqualTo("follow_request");
        assertThat(list.at("/0/actor/username").asString()).isEqualTo("linh");
        assertThat(unread(rafael)).isOne();
    }

    @Test
    void approvingReplacesTheRequestAndTellsTheRequester() throws Exception {
        data.setPreference(rafael, "profile_visibility", "private");
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        api.post(rafael, "/api/me/follow-requests/" + linh + "/approve", null).andExpect(status().isNoContent());
        assertThat(types(rafael)).isEmpty();
        assertThat(unread(rafael)).isZero();
        assertThat(types(linh)).containsExactly("follow_accepted");
        assertThat(api.getOk(linh, "/api/profiles/rafael").get("isFollowing").asBoolean()).isTrue();
    }

    @Test
    void decliningOrCancellingRetractsTheRequest() throws Exception {
        data.setPreference(rafael, "profile_visibility", "private");
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        api.delete(rafael, "/api/me/follow-requests/" + linh).andExpect(status().isNoContent());
        assertThat(types(rafael)).isEmpty();
        assertThat(types(linh)).isEmpty();

        api.put(linh, "/api/profiles/" + rafael + "/follow");
        api.delete(linh, "/api/profiles/" + rafael + "/follow").andExpect(status().isOk());
        assertThat(types(rafael)).isEmpty();
    }

    @Test
    void goingPublicRetractsPendingRequests() throws Exception {
        data.setPreference(rafael, "profile_visibility", "private");
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        mvc.perform(withJson(patch("/api/me/preferences"), Map.of("privacy", Map.of("profileVisibility", "public")))
                        .with(as(rafael)))
                .andExpect(status().isOk());
        assertThat(types(rafael)).isEmpty();
        assertThat(api.getOk(linh, "/api/profiles/rafael").get("isFollowing").asBoolean()).isTrue();
    }

    @Test
    void followRequestsHonorTheFollowersPreference() throws Exception {
        data.setPreference(rafael, "profile_visibility", "private");
        data.setPreference(rafael, "notify_followers", false);
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        assertThat(types(rafael)).isEmpty();
        assertThat(api.getOk(rafael, "/api/me/follow-requests").size()).isOne();
    }
}
