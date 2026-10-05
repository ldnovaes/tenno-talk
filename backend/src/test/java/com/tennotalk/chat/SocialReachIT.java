package com.tennotalk.chat;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reaching another person: their profile (from Discover or a chat), the unread count and the
 * notification of a new message. The last tests pin the production report of 2026-10-04, where a
 * forgotten block produced all of these symptoms at once.
 */
class SocialReachIT extends IntegrationTest {

    private long unreadNotifications(UUID user) throws Exception {
        return api.getOk(user, "/api/notifications/unread-count").get("count").asLong();
    }

    private int unreadIn(UUID user, UUID conversation) throws Exception {
        for (JsonNode item : steps.conversations(user)) {
            if (item.get("id").asString().equals(conversation.toString())) return item.get("unreadCount").asInt();
        }
        throw new AssertionError("Conversation not listed for " + user);
    }

    private String otherMemberUsername(UUID viewer, UUID conversation) throws Exception {
        for (JsonNode item : steps.conversations(viewer)) {
            if (!item.get("id").asString().equals(conversation.toString())) continue;
            for (JsonNode member : item.get("members")) {
                if (!member.at("/user/id").asString().equals(viewer.toString())) return member.at("/user/username").asString();
            }
        }
        throw new AssertionError("No other member in " + conversation);
    }

    @Test
    void chatPartnersOpenEachOthersProfilesFromTheConversation() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR"), linh = data.user("linh", "vi-VN");
        UUID conversation = steps.direct(rafael, linh);
        steps.send(rafael, conversation, "Oi!");

        // The chat header links to the other member's username, as the SPA does.
        assertThat(api.getOk(rafael, "/api/profiles/" + otherMemberUsername(rafael, conversation)).get("id").asString())
                .isEqualTo(linh.toString());
        assertThat(api.getOk(linh, "/api/profiles/" + otherMemberUsername(linh, conversation)).get("id").asString())
                .isEqualTo(rafael.toString());
    }

    @Test
    void everyDiscoverCardOpensItsProfile() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        data.user("linh", "vi-VN");
        data.user("sofia", "es-ES");

        JsonNode items = api.getOk(rafael, "/api/discover").get("items");
        assertThat(items.size()).isEqualTo(2);
        for (JsonNode card : items) {
            api.get(rafael, "/api/profiles/" + card.get("username").asString()).andExpect(status().isOk());
        }
    }

    @Test
    void anIncomingMessageRaisesOnlyTheRecipientsUnreadCount() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR"), linh = data.user("linh", "vi-VN");
        UUID conversation = steps.direct(rafael, linh);
        steps.send(rafael, conversation, "Um");
        String last = steps.send(rafael, conversation, "Dois").get("id").asString();

        assertThat(unreadIn(linh, conversation)).isEqualTo(2);
        assertThat(unreadIn(rafael, conversation)).isZero();

        api.post(linh, "/api/conversations/" + conversation + "/read", Map.of("messageId", last)).andExpect(status().isNoContent());
        assertThat(unreadIn(linh, conversation)).isZero();
    }

    @Test
    void anIncomingMessageNotifiesTheRecipientOnly() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR"), linh = data.user("linh", "vi-VN");
        UUID conversation = steps.direct(rafael, linh);
        String message = steps.send(rafael, conversation, "Oi!").get("id").asString();

        assertThat(unreadNotifications(linh)).isOne();
        assertThat(unreadNotifications(rafael)).isZero();
        JsonNode notification = api.getOk(linh, "/api/notifications").get(0);
        assertThat(notification.get("type").asString()).isEqualTo("new_message");
        assertThat(notification.at("/actor/username").asString()).isEqualTo("rafael");
        assertThat(notification.get("conversationId").asString()).isEqualTo(conversation.toString());
        assertThat(notification.get("messageId").asString()).isEqualTo(message);
    }

    /** Production, 2026-10-04: one account blocked the other mid-test and nothing on screen said so. */
    @Test
    void aBlockHidesBothProfilesAndSilencesTheConversationBothWays() throws Exception {
        UUID caladris = data.user("caladris", "pt-BR"), teste = data.user("teste", "pt-BR");
        UUID conversation = steps.direct(teste, caladris);
        steps.send(teste, conversation, "antes do bloqueio");
        steps.send(caladris, conversation, "resposta");

        api.put(caladris, "/api/profiles/" + teste + "/block").andExpect(status().isNoContent());

        api.get(caladris, "/api/profiles/teste").andExpect(status().isNotFound());
        api.get(teste, "/api/profiles/caladris").andExpect(status().isNotFound());
        assertThat(api.getOk(caladris, "/api/discover").get("items").size()).isZero();
        assertThat(api.getOk(teste, "/api/discover").get("items").size()).isZero();
        int testeUnread = unreadIn(teste, conversation), caladrisUnread = unreadIn(caladris, conversation);
        for (UUID sender : new UUID[] {caladris, teste}) {
            api.post(sender, "/api/conversations/" + conversation + "/messages", Map.of("clientId", "after-" + sender, "text", "depois"))
                    .andExpect(status().isForbidden());
        }
        assertThat(unreadIn(teste, conversation)).isEqualTo(testeUnread);
        assertThat(unreadIn(caladris, conversation)).isEqualTo(caladrisUnread);
        // Notifications between the pair disappear, including the ones from before the block.
        assertThat(unreadNotifications(teste) + unreadNotifications(caladris)).isZero();
        // The conversation itself stays listed for both, which is why the block went unnoticed.
        assertThat(steps.conversations(caladris).size()).isOne();
        assertThat(steps.conversations(teste).size()).isOne();
    }

    /** After unblocking, a followers-only account must follow the other person again to hear from them. */
    @Test
    void unblockingRestoresProfilesButFollowersOnlyStillNeedsAFollowBack() throws Exception {
        UUID caladris = data.user("caladris", "pt-BR"), teste = data.user("teste", "pt-BR");
        data.setPreference(caladris, "who_can_message", "followers");
        data.follow(caladris, teste);
        UUID conversation = steps.direct(teste, caladris);
        api.put(caladris, "/api/profiles/" + teste + "/block").andExpect(status().isNoContent());

        api.delete(caladris, "/api/profiles/" + teste + "/block").andExpect(status().isNoContent());

        api.get(caladris, "/api/profiles/teste").andExpect(status().isOk());
        api.get(teste, "/api/profiles/caladris").andExpect(status().isOk());
        steps.send(caladris, conversation, "voltei");
        assertThat(unreadIn(teste, conversation)).isOne();
        // The block removed the follow, so teste no longer reaches caladris.
        api.post(teste, "/api/conversations/" + conversation + "/messages", Map.of("clientId", "no-follow", "text", "oi"))
                .andExpect(status().isForbidden());
        api.put(caladris, "/api/profiles/" + teste + "/follow").andExpect(status().isOk());
        steps.send(teste, conversation, "agora sim");
        assertThat(unreadIn(caladris, conversation)).isOne();
        assertThat(unreadNotifications(caladris)).isOne();
    }
}
