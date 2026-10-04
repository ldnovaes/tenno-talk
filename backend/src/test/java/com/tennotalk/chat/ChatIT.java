package com.tennotalk.chat;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static com.tennotalk.support.TestData.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ChatIT extends IntegrationTest {

    private UUID rafael;
    private UUID linh;
    private UUID sofia;

    @BeforeEach
    void people() {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
        sofia = data.user("sofia", "es-ES");
    }

    private long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    @Test
    void directConversationIsCreatedOnceForBothSides() throws Exception {
        UUID first = steps.direct(rafael, linh);
        UUID again = steps.direct(linh, rafael);
        assertThat(again).isEqualTo(first);
        mvc.perform(get("/api/conversations/" + first).with(as(linh)))
                .andExpect(jsonPath("$.kind").value("direct"))
                .andExpect(jsonPath("$.members", hasSize(2)))
                .andExpect(jsonPath("$.members[?(@.user.username == 'linh')].receivingLanguage").value("vi-VN"));
    }

    @Test
    void directConversationsRespectPrivacyAndBlocks() throws Exception {
        data.setPreference(linh, "who_can_message", "nobody");
        data.setPreference(sofia, "who_can_message", "followers");
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", linh)).with(as(rafael)))
                .andExpect(status().isForbidden());
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", sofia)).with(as(rafael)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("This person only accepts messages from people they follow."));
        data.follow(sofia, rafael);
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", sofia)).with(as(rafael))).andExpect(status().isOk());
        UUID omar = data.user("omar", "ar");
        data.block(omar, rafael);
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", omar)).with(as(rafael))).andExpect(status().isForbidden());
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", rafael)).with(as(rafael))).andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", UUID.randomUUID())).with(as(rafael)))
                .andExpect(status().isNotFound());
    }

    @Test
    void privacyChangesAndBlocksStopNewMessagesInAnExistingConversation() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        JsonNode original = steps.send(rafael, conversation, "Before privacy changed", "before-privacy");
        data.setPreference(linh, "who_can_message", "nobody");
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"),
                Map.of("clientId", "after-privacy", "text", "This must not arrive")).with(as(rafael)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("Messaging is unavailable."));
        mvc.perform(withJson(post("/api/messages/" + original.get("id").asString() + "/forward"),
                Map.of("conversationIds", List.of(conversation))).with(as(rafael)))
                .andExpect(status().isForbidden());
        assertThat(count("SELECT count(*) FROM messages")).isOne();
        assertThat(count("SELECT count(*) FROM notifications WHERE recipient_id = '" + linh + "'")).isOne();

        data.setPreference(linh, "who_can_message", "followers");
        data.follow(linh, rafael);
        steps.send(rafael, conversation, "Allowed by Linh", "allowed");
        data.block(linh, rafael);
        for (UUID sender : List.of(rafael, linh)) {
            mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"),
                    Map.of("clientId", "blocked-" + sender, "text", "Blocked")).with(as(sender)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.detail").value("Messaging is unavailable."));
        }
        assertThat(count("SELECT count(*) FROM messages")).isEqualTo(2);
        assertThat(count("SELECT count(*) FROM notifications WHERE recipient_id = '" + linh + "'")).isEqualTo(2);
    }

    @Test
    void sendingStoresTheOriginalInTheSendersLanguageAndQueuesTheTranslation() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        JsonNode sent = steps.send(rafael, conversation, "  Estou com saudade de você.  ");
        assertThat(sent.at("/content/type").asString()).isEqualTo("text");
        assertThat(sent.at("/content/body/text").asString()).isEqualTo("Estou com saudade de você.");
        assertThat(sent.at("/content/body/language").asString()).isEqualTo("pt-BR");
        assertThat(sent.at("/deliveryStatus").asString()).isEqualTo("sent");
        // Own message: shows what the other person receives.
        assertThat(sent.at("/translation/targetLanguage").asString()).isEqualTo("vi-VN");
        assertThat(sent.at("/translation/status").asString()).isEqualTo("pending");
        assertThat(count("SELECT count(*) FROM translation_jobs WHERE target_language = 'vi-VN' AND status = 'pending'")).isOne();
    }

    @Test
    void sendingIsIdempotentByClientId() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        JsonNode first = steps.send(rafael, conversation, "Oi", "client-1");
        JsonNode retry = steps.send(rafael, conversation, "Oi", "client-1");
        assertThat(retry.get("id").asString()).isEqualTo(first.get("id").asString());
        assertThat(retry.get("clientId").asString()).isEqualTo("client-1");
        assertThat(count("SELECT count(*) FROM messages")).isOne();
        assertThat(count("SELECT count(*) FROM translation_jobs")).isOne();
    }

    @Test
    void invalidMessagesAreRejected() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"), Map.of("clientId", "a", "text", "   ")).with(as(rafael)))
                .andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"), Map.of("clientId", "b", "text", "x".repeat(4001))).with(as(rafael)))
                .andExpect(status().isBadRequest());
        UUID other = steps.direct(rafael, sofia);
        String foreign = steps.send(rafael, other, "Hola").get("id").asString();
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"),
                        Map.of("clientId", "c", "text", "re", "replyToId", foreign)).with(as(rafael)))
                .andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"),
                        Map.of("clientId", "d", "text", "x", "mediaIds", List.of(UUID.randomUUID()))).with(as(rafael)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void outsidersCannotSeeOrWriteInAConversation() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        String message = steps.send(rafael, conversation, "segredo").get("id").asString();
        mvc.perform(get("/api/conversations/" + conversation).with(as(sofia))).andExpect(status().isForbidden());
        mvc.perform(get("/api/conversations/" + conversation + "/messages").with(as(sofia))).andExpect(status().isForbidden());
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"), Map.of("clientId", "x", "text", "hi")).with(as(sofia)))
                .andExpect(status().isForbidden());
        mvc.perform(withJson(post("/api/messages/" + message + "/reactions"), Map.of("emoji", "👍")).with(as(sofia)))
                .andExpect(status().isForbidden());
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/read"), Map.of("messageId", message)).with(as(sofia)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/conversations/" + UUID.randomUUID()).with(as(sofia))).andExpect(status().isNotFound());
        mvc.perform(get("/api/conversations/not-a-uuid").with(as(sofia))).andExpect(status().isNotFound());
    }

    @Test
    void eachSideSeesItsOwnLanguage() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        steps.send(linh, conversation, "Em nhớ anh.");
        JsonNode forRafael = steps.lastMessage(rafael, conversation);
        assertThat(forRafael.at("/translation/targetLanguage").asString()).isEqualTo("pt-BR");
        assertThat(forRafael.at("/deliveryStatus").asString()).isEqualTo("read");
        JsonNode forLinh = steps.lastMessage(linh, conversation);
        assertThat(forLinh.at("/translation/targetLanguage").asString()).isEqualTo("pt-BR");
        assertThat(forLinh.at("/content/body/text").asString()).isEqualTo("Em nhớ anh.");
    }

    @Test
    void sameLanguageNeedsNoTranslation() throws Exception {
        UUID minh = data.user("minh", "vi-VN");
        UUID conversation = steps.direct(linh, minh);
        JsonNode sent = steps.send(linh, conversation, "Đi chứ!");
        assertThat(sent.at("/translation/status").asString()).isEqualTo("not_needed");
        assertThat(count("SELECT count(*) FROM translation_jobs")).isZero();
    }

    @Test
    void messagesPaginateBackwardsInChronologicalPages() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        for (int i = 0; i < 31; i++) steps.send(rafael, conversation, "m" + i);
        JsonNode first = steps.messages(rafael, conversation);
        assertThat(first.get("items")).hasSize(30);
        assertThat(first.get("items").get(0).at("/content/body/text").asString()).isEqualTo("m1");
        assertThat(first.get("items").get(29).at("/content/body/text").asString()).isEqualTo("m30");
        String cursor = first.get("nextCursor").asString();
        JsonNode second = steps.read(mvc.perform(get("/api/conversations/" + conversation + "/messages").param("cursor", cursor).with(as(rafael)))
                .andReturn().getResponse().getContentAsString());
        assertThat(second.get("items")).hasSize(1);
        assertThat(second.get("items").get(0).at("/content/body/text").asString()).isEqualTo("m0");
        assertThat(second.get("nextCursor").isNull()).isTrue();
        mvc.perform(get("/api/conversations/" + conversation + "/messages").param("cursor", "garbage").with(as(rafael)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void conversationsListShowsLastMessageUnreadAndOrder() throws Exception {
        UUID withLinh = steps.direct(rafael, linh);
        UUID withSofia = steps.direct(rafael, sofia);
        steps.send(linh, withLinh, "Chào anh");
        steps.send(linh, withLinh, "Anh khỏe không?");
        steps.send(sofia, withSofia, "Hola");
        JsonNode list = steps.conversations(rafael);
        assertThat(list.get(0).get("id").asString()).isEqualTo(withSofia.toString());
        assertThat(list.get(1).get("unreadCount").asInt()).isEqualTo(2);
        assertThat(list.get(1).at("/lastMessage/content/body/text").asString()).isEqualTo("Anh khỏe không?");
        assertThat(list.get(1).at("/mutedUntil").isNull()).isTrue();
    }

    @Test
    void ticksGoFromSentToDeliveredToRead() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        String id = steps.send(rafael, conversation, "Oi").get("id").asString();
        assertThat(steps.lastMessage(rafael, conversation).get("deliveryStatus").asString()).isEqualTo("sent");
        steps.conversations(linh);
        assertThat(steps.lastMessage(rafael, conversation).get("deliveryStatus").asString()).isEqualTo("sent");
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/delivered"), Map.of("messageIds", List.of(id))).with(as(linh)))
                .andExpect(status().isNoContent());
        assertThat(steps.lastMessage(rafael, conversation).get("deliveryStatus").asString()).isEqualTo("delivered");
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/read"), Map.of("messageId", id)).with(as(linh)))
                .andExpect(status().isNoContent());
        assertThat(steps.lastMessage(rafael, conversation).get("deliveryStatus").asString()).isEqualTo("read");
        assertThat(steps.conversations(linh).get(0).get("unreadCount").asInt()).isZero();
    }

    @Test
    void readCursorNeverMovesBackwards() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        String older = steps.send(rafael, conversation, "1").get("id").asString();
        String newer = steps.send(rafael, conversation, "2").get("id").asString();
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/read"), Map.of("messageId", newer)).with(as(linh)));
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/read"), Map.of("messageId", older)).with(as(linh)));
        String cursor = jdbc.sql("SELECT last_read_message_id::text FROM conversation_members WHERE user_id = :u")
                .param("u", linh).query(String.class).single();
        assertThat(cursor).isEqualTo(newer);
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/read"), Map.of("messageId", UUID.randomUUID())).with(as(linh)))
                .andExpect(status().isNotFound());
    }

    @Test
    void reactionsToggleAndSummarize() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        String id = steps.send(rafael, conversation, "Oi").get("id").asString();
        mvc.perform(withJson(post("/api/messages/" + id + "/reactions"), Map.of("emoji", "❤️")).with(as(linh)))
                .andExpect(jsonPath("$.reactions[0].emoji").value("❤️"))
                .andExpect(jsonPath("$.reactions[0].count").value(1))
                .andExpect(jsonPath("$.reactions[0].reactedByMe").value(true));
        mvc.perform(withJson(post("/api/messages/" + id + "/reactions"), Map.of("emoji", "❤️")).with(as(rafael)))
                .andExpect(jsonPath("$.reactions[0].count").value(2));
        mvc.perform(withJson(post("/api/messages/" + id + "/reactions"), Map.of("emoji", "❤️")).with(as(linh)))
                .andExpect(jsonPath("$.reactions[0].count").value(1))
                .andExpect(jsonPath("$.reactions[0].reactedByMe").value(false));
    }

    @Test
    void repliesQuoteTheMessageInTheReadersLanguage() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        String original = steps.send(linh, conversation, "Em nhớ anh.").get("id").asString();
        jdbc.sql("UPDATE message_translations SET status = 'translated', text = 'Estou com saudade.', version = 1").update();
        JsonNode reply = steps.read(mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"),
                        Map.of("clientId", "r1", "text", "Eu também", "replyToId", original)).with(as(rafael)))
                .andReturn().getResponse().getContentAsString());
        assertThat(reply.at("/replyTo/messageId").asString()).isEqualTo(original);
        assertThat(reply.at("/replyTo/preview").asString()).isEqualTo("Estou com saudade.");
        assertThat(steps.lastMessage(linh, conversation).at("/replyTo/preview").asString()).isEqualTo("Em nhớ anh.");
    }

    @Test
    void forwardCopiesTheOriginalOnlyToConversationsOfTheSender() throws Exception {
        UUID withLinh = steps.direct(rafael, linh);
        UUID withSofia = steps.direct(rafael, sofia);
        String id = steps.send(linh, withLinh, "Em nhớ anh.").get("id").asString();
        mvc.perform(withJson(post("/api/messages/" + id + "/forward"), Map.of("conversationIds", List.of(withSofia))).with(as(rafael)))
                .andExpect(status().isNoContent());
        JsonNode forwarded = steps.lastMessage(sofia, withSofia);
        assertThat(forwarded.at("/content/body/text").asString()).isEqualTo("Em nhớ anh.");
        assertThat(forwarded.at("/senderId").asString()).isEqualTo(rafael.toString());
        assertThat(forwarded.at("/translation/targetLanguage").asString()).isEqualTo("es-ES");
        UUID emma = data.user("emma", "en-US");
        UUID notMine = steps.direct(linh, emma);
        mvc.perform(withJson(post("/api/messages/" + id + "/forward"), Map.of("conversationIds", List.of(notMine))).with(as(rafael)))
                .andExpect(status().isForbidden());
    }

    @Test
    void muteIsPerMember() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        mvc.perform(withJson(put("/api/conversations/" + conversation + "/mute"), Map.of("muted", true)).with(as(rafael)))
                .andExpect(jsonPath("$.mutedUntil").isNotEmpty());
        mvc.perform(get("/api/conversations/" + conversation).with(as(linh))).andExpect(jsonPath("$.mutedUntil").isEmpty());
        mvc.perform(withJson(put("/api/conversations/" + conversation + "/mute"), Map.of("muted", false)).with(as(rafael)))
                .andExpect(jsonPath("$.mutedUntil").isEmpty());
    }

    @Test
    void eachPersonCreatesAtMostOneGroup() throws Exception {
        UUID emma = data.user("emma", "en-US");
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", " Intercâmbio ", "memberIds", List.of(linh, sofia))).with(as(rafael)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("group"))
                .andExpect(jsonPath("$.title").value("Intercâmbio"))
                .andExpect(jsonPath("$.members", hasSize(3)));
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", "Outro", "memberIds", List.of(linh, emma))).with(as(rafael)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("You can create only one group."));
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", "Linh's", "memberIds", List.of(rafael, emma))).with(as(linh)))
                .andExpect(status().isOk());
    }

    @Test
    void groupsValidateNameAndMembers() throws Exception {
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", " ", "memberIds", List.of(linh, sofia))).with(as(rafael)))
                .andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", "Duo", "memberIds", List.of(linh, rafael))).with(as(rafael)))
                .andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", "X", "memberIds", List.of(linh, UUID.randomUUID()))).with(as(rafael)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void groupMessagesFanOutToEveryLanguage() throws Exception {
        UUID group = UUID.fromString(steps.read(mvc.perform(withJson(post("/api/conversations/groups"),
                        Map.of("title", "Trio", "memberIds", List.of(linh, sofia))).with(as(rafael)))
                .andReturn().getResponse().getContentAsString()).get("id").asString());
        JsonNode sent = steps.send(rafael, group, "Obrigado!");
        assertThat(sent.get("translation").isNull()).isTrue();
        List<String> targets = jdbc.sql("SELECT target_language FROM translation_jobs ORDER BY target_language").query(String.class).list();
        assertThat(targets).containsExactly("es-ES", "vi-VN");
        assertThat(steps.lastMessage(sofia, group).at("/translation/targetLanguage").asString()).isEqualTo("es-ES");
    }

    @Test
    void aMessageWithoutAStoredTranslationShowsOnlyTheOriginal() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        steps.send(linh, conversation, "Chào anh");
        jdbc.sql("DELETE FROM message_translations").update();
        assertThat(steps.lastMessage(rafael, conversation).get("translation").isNull()).isTrue();
        assertThat(count("SELECT count(*) FROM translation_jobs")).isOne();
    }
}
