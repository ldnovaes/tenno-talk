package com.tennotalk.chat;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import com.tennotalk.support.IntegrationTest;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SocialDeliveryIT extends IntegrationTest {
    @Test
    void followingControlsDistributionButNotPublicDirectLinks() throws Exception {
        UUID viewer = data.user("viewer", "en-US"), followed = data.user("followed", "en-US"), other = data.user("other", "en-US");
        data.follow(viewer, followed);
        for (UUID author : List.of(viewer, followed, other)) {
            api.postOk(author, "/api/posts", Map.of("mediaIds", List.of(data.media(author, "image")), "caption", "post"));
            api.postOk(author, "/api/stories", Map.of("mediaId", data.media(author, "image")));
        }
        assertThat(api.getOk(viewer, "/api/feed").get("items").size()).isEqualTo(2);
        assertThat(api.getOk(viewer, "/api/stories/tray").size()).isEqualTo(2);
        assertThat(api.getOk(viewer, "/api/stories/by-user/" + other).size()).isOne();
        jdbc.sql("DELETE FROM follows WHERE follower_id = :v").param("v", viewer).update();
        assertThat(api.getOk(viewer, "/api/feed").get("items").size()).isOne();
        assertThat(api.getOk(viewer, "/api/stories/tray").size()).isOne();
        data.block(other, viewer);
        assertThat(api.getOk(viewer, "/api/stories/by-user/" + other).size()).isZero();
    }
    @Test
    void groupDeliveryRequiresEveryRecipientAndCannotAcknowledgeAnotherConversation() throws Exception {
        UUID sender = data.user("sender", "en-US"), first = data.user("first", "en-US"), second = data.user("second", "en-US");
        var group = api.postOk(sender, "/api/conversations/groups", Map.of("title", "Group", "memberIds", List.of(first, second)));
        UUID conversation = UUID.fromString(group.get("id").asString());
        String id = steps.send(sender, conversation, "hello").get("id").asString();
        api.post(first, "/api/conversations/" + conversation + "/delivered", Map.of("messageIds", List.of(id))).andExpect(status().isNoContent());
        assertThat(steps.lastMessage(sender, conversation).get("deliveryStatus").asString()).isEqualTo("sent");
        api.post(second, "/api/conversations/" + conversation + "/delivered", Map.of("messageIds", List.of(id))).andExpect(status().isNoContent());
        assertThat(steps.lastMessage(sender, conversation).get("deliveryStatus").asString()).isEqualTo("delivered");
        UUID another = steps.direct(first, second);
        api.post(first, "/api/conversations/" + another + "/delivered", Map.of("messageIds", List.of(id))).andExpect(status().isNotFound());
        api.post(first, "/api/conversations/" + conversation + "/read", Map.of("messageId", id));
        assertThat(steps.lastMessage(sender, conversation).get("deliveryStatus").asString()).isEqualTo("delivered");
        api.post(second, "/api/conversations/" + conversation + "/read", Map.of("messageId", id));
        assertThat(steps.lastMessage(sender, conversation).get("deliveryStatus").asString()).isEqualTo("read");
    }
    @Test
    void readingObservedNotificationsDoesNotClearANewArrival() throws Exception {
        UUID sender = data.user("sender", "en-US"), recipient = data.user("recipient", "en-US");
        UUID conversation = steps.direct(sender, recipient);
        steps.send(sender, conversation, "one");
        var first = api.getOk(recipient, "/api/notifications").get(0).get("id").asString();
        steps.send(sender, conversation, "two");
        api.post(recipient, "/api/notifications/read", Map.of("ids", List.of(first))).andExpect(status().isNoContent());
        assertThat(jdbc.sql("SELECT count(*) FROM notifications WHERE recipient_id=:u AND read_at IS NULL").param("u", recipient).query(Long.class).single()).isOne();
    }
    @Test
    void commentsPaginateAndRetryWithoutDuplicateNotification() throws Exception {
        UUID author = data.user("author", "en-US"), viewer = data.user("viewer", "en-US");
        String post = api.postOk(author, "/api/posts", Map.of("mediaIds", List.of(data.media(author, "image")))).get("id").asString();
        String last = "";
        for (int i = 0; i < 51; i++) last = api.postOk(viewer, "/api/posts/" + post + "/comments", Map.of("text", "comment " + i, "clientId", "comment-" + i)).get("id").asString();
        var page = api.getOk(viewer, "/api/posts/" + post + "/comments");
        assertThat(page.size()).isEqualTo(50);
        assertThat(api.getOk(viewer, "/api/posts/" + post + "/comments?afterId=" + page.get(49).get("id").asString()).size()).isOne();
        assertThat(api.getOk(viewer, "/api/posts/" + post + "/comments?targetId=" + last).get(0).get("id").asString()).isEqualTo(last);
        assertThat(api.postOk(viewer, "/api/posts/" + post + "/comments", Map.of("text", "comment 50", "clientId", "comment-50")).get("id").asString()).isEqualTo(last);
        assertThat(jdbc.sql("SELECT count(*) FROM notifications WHERE type='comment'").query(Long.class).single()).isEqualTo(51);
    }
}
