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

    private UUID lucas;
    private UUID cam;
    private UUID sofia;

    @BeforeEach
    void people() {
        lucas = data.user("lucas", "pt-BR");
        cam = data.user("cam", "vi-VN");
        sofia = data.user("sofia", "es-ES");
    }

    private long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    @Test
    void directConversationIsCreatedOnceForBothSides() throws Exception {
        UUID first = steps.direct(lucas, cam);
        UUID again = steps.direct(cam, lucas);
        assertThat(again).isEqualTo(first);
        mvc.perform(get("/api/conversations/" + first).with(as(cam)))
                .andExpect(jsonPath("$.kind").value("direct"))
                .andExpect(jsonPath("$.members", hasSize(2)))
                .andExpect(jsonPath("$.members[?(@.user.username == 'cam')].receivingLanguage").value("vi-VN"));
    }

    @Test
    void directConversationsRespectPrivacyAndBlocks() throws Exception {
        data.setPreference(cam, "who_can_message", "nobody");
        data.setPreference(sofia, "who_can_message", "followers");
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", cam)).with(as(lucas)))
                .andExpect(status().isForbidden());
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", sofia)).with(as(lucas)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail").value("This person only accepts messages from people they follow."));
        data.follow(sofia, lucas);
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", sofia)).with(as(lucas))).andExpect(status().isOk());
        UUID omar = data.user("omar", "ar");
        data.block(omar, lucas);
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", omar)).with(as(lucas))).andExpect(status().isForbidden());
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", lucas)).with(as(lucas))).andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/conversations/direct"), Map.of("userId", UUID.randomUUID())).with(as(lucas)))
                .andExpect(status().isNotFound());
    }

    @Test
    void sendingStoresTheOriginalInTheSendersLanguageAndQueuesTheTranslation() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        JsonNode sent = steps.send(lucas, conversation, "  Estou com saudade de você.  ");
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
        UUID conversation = steps.direct(lucas, cam);
        JsonNode first = steps.send(lucas, conversation, "Oi", "client-1");
        JsonNode retry = steps.send(lucas, conversation, "Oi", "client-1");
        assertThat(retry.get("id").asString()).isEqualTo(first.get("id").asString());
        assertThat(retry.get("clientId").asString()).isEqualTo("client-1");
        assertThat(count("SELECT count(*) FROM messages")).isOne();
        assertThat(count("SELECT count(*) FROM translation_jobs")).isOne();
    }

    @Test
    void invalidMessagesAreRejected() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"), Map.of("clientId", "a", "text", "   ")).with(as(lucas)))
                .andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"), Map.of("clientId", "b", "text", "x".repeat(4001))).with(as(lucas)))
                .andExpect(status().isBadRequest());
        UUID other = steps.direct(lucas, sofia);
        String foreign = steps.send(lucas, other, "Hola").get("id").asString();
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"),
                        Map.of("clientId", "c", "text", "re", "replyToId", foreign)).with(as(lucas)))
                .andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"),
                        Map.of("clientId", "d", "text", "x", "mediaIds", List.of(UUID.randomUUID()))).with(as(lucas)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void outsidersCannotSeeOrWriteInAConversation() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        String message = steps.send(lucas, conversation, "segredo").get("id").asString();
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
        UUID conversation = steps.direct(lucas, cam);
        steps.send(cam, conversation, "Em nhớ anh.");
        JsonNode forLucas = steps.lastMessage(lucas, conversation);
        assertThat(forLucas.at("/translation/targetLanguage").asString()).isEqualTo("pt-BR");
        assertThat(forLucas.at("/deliveryStatus").asString()).isEqualTo("read");
        JsonNode forCam = steps.lastMessage(cam, conversation);
        assertThat(forCam.at("/translation/targetLanguage").asString()).isEqualTo("pt-BR");
        assertThat(forCam.at("/content/body/text").asString()).isEqualTo("Em nhớ anh.");
    }

    @Test
    void sameLanguageNeedsNoTranslation() throws Exception {
        UUID minh = data.user("minh", "vi-VN");
        UUID conversation = steps.direct(cam, minh);
        JsonNode sent = steps.send(cam, conversation, "Đi chứ!");
        assertThat(sent.at("/translation/status").asString()).isEqualTo("not_needed");
        assertThat(count("SELECT count(*) FROM translation_jobs")).isZero();
    }

    @Test
    void messagesPaginateBackwardsInChronologicalPages() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        for (int i = 0; i < 31; i++) steps.send(lucas, conversation, "m" + i);
        JsonNode first = steps.messages(lucas, conversation);
        assertThat(first.get("items")).hasSize(30);
        assertThat(first.get("items").get(0).at("/content/body/text").asString()).isEqualTo("m1");
        assertThat(first.get("items").get(29).at("/content/body/text").asString()).isEqualTo("m30");
        String cursor = first.get("nextCursor").asString();
        JsonNode second = steps.read(mvc.perform(get("/api/conversations/" + conversation + "/messages").param("cursor", cursor).with(as(lucas)))
                .andReturn().getResponse().getContentAsString());
        assertThat(second.get("items")).hasSize(1);
        assertThat(second.get("items").get(0).at("/content/body/text").asString()).isEqualTo("m0");
        assertThat(second.get("nextCursor").isNull()).isTrue();
        mvc.perform(get("/api/conversations/" + conversation + "/messages").param("cursor", "garbage").with(as(lucas)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void conversationsListShowsLastMessageUnreadAndOrder() throws Exception {
        UUID withCam = steps.direct(lucas, cam);
        UUID withSofia = steps.direct(lucas, sofia);
        steps.send(cam, withCam, "Chào anh");
        steps.send(cam, withCam, "Anh khỏe không?");
        steps.send(sofia, withSofia, "Hola");
        JsonNode list = steps.conversations(lucas);
        assertThat(list.get(0).get("id").asString()).isEqualTo(withSofia.toString());
        assertThat(list.get(1).get("unreadCount").asInt()).isEqualTo(2);
        assertThat(list.get(1).at("/lastMessage/content/body/text").asString()).isEqualTo("Anh khỏe không?");
        assertThat(list.get(1).at("/mutedUntil").isNull()).isTrue();
    }

    @Test
    void ticksGoFromSentToDeliveredToRead() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        String id = steps.send(lucas, conversation, "Oi").get("id").asString();
        assertThat(steps.lastMessage(lucas, conversation).get("deliveryStatus").asString()).isEqualTo("sent");
        steps.conversations(cam); // Cam's device synced.
        assertThat(steps.lastMessage(lucas, conversation).get("deliveryStatus").asString()).isEqualTo("delivered");
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/read"), Map.of("messageId", id)).with(as(cam)))
                .andExpect(status().isNoContent());
        assertThat(steps.lastMessage(lucas, conversation).get("deliveryStatus").asString()).isEqualTo("read");
        assertThat(steps.conversations(cam).get(0).get("unreadCount").asInt()).isZero();
    }

    @Test
    void readCursorNeverMovesBackwards() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        String older = steps.send(lucas, conversation, "1").get("id").asString();
        String newer = steps.send(lucas, conversation, "2").get("id").asString();
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/read"), Map.of("messageId", newer)).with(as(cam)));
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/read"), Map.of("messageId", older)).with(as(cam)));
        String cursor = jdbc.sql("SELECT last_read_message_id::text FROM conversation_members WHERE user_id = :u")
                .param("u", cam).query(String.class).single();
        assertThat(cursor).isEqualTo(newer);
        mvc.perform(withJson(post("/api/conversations/" + conversation + "/read"), Map.of("messageId", UUID.randomUUID())).with(as(cam)))
                .andExpect(status().isNotFound());
    }

    @Test
    void reactionsToggleAndSummarize() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        String id = steps.send(lucas, conversation, "Oi").get("id").asString();
        mvc.perform(withJson(post("/api/messages/" + id + "/reactions"), Map.of("emoji", "❤️")).with(as(cam)))
                .andExpect(jsonPath("$.reactions[0].emoji").value("❤️"))
                .andExpect(jsonPath("$.reactions[0].count").value(1))
                .andExpect(jsonPath("$.reactions[0].reactedByMe").value(true));
        mvc.perform(withJson(post("/api/messages/" + id + "/reactions"), Map.of("emoji", "❤️")).with(as(lucas)))
                .andExpect(jsonPath("$.reactions[0].count").value(2));
        mvc.perform(withJson(post("/api/messages/" + id + "/reactions"), Map.of("emoji", "❤️")).with(as(cam)))
                .andExpect(jsonPath("$.reactions[0].count").value(1))
                .andExpect(jsonPath("$.reactions[0].reactedByMe").value(false));
    }

    @Test
    void repliesQuoteTheMessageInTheReadersLanguage() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        String original = steps.send(cam, conversation, "Em nhớ anh.").get("id").asString();
        jdbc.sql("UPDATE message_translations SET status = 'translated', text = 'Estou com saudade.', version = 1").update();
        JsonNode reply = steps.read(mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages"),
                        Map.of("clientId", "r1", "text", "Eu também", "replyToId", original)).with(as(lucas)))
                .andReturn().getResponse().getContentAsString());
        assertThat(reply.at("/replyTo/messageId").asString()).isEqualTo(original);
        assertThat(reply.at("/replyTo/preview").asString()).isEqualTo("Estou com saudade.");
        assertThat(steps.lastMessage(cam, conversation).at("/replyTo/preview").asString()).isEqualTo("Em nhớ anh.");
    }

    @Test
    void forwardCopiesTheOriginalOnlyToConversationsOfTheSender() throws Exception {
        UUID withCam = steps.direct(lucas, cam);
        UUID withSofia = steps.direct(lucas, sofia);
        String id = steps.send(cam, withCam, "Em nhớ anh.").get("id").asString();
        mvc.perform(withJson(post("/api/messages/" + id + "/forward"), Map.of("conversationIds", List.of(withSofia))).with(as(lucas)))
                .andExpect(status().isNoContent());
        JsonNode forwarded = steps.lastMessage(sofia, withSofia);
        assertThat(forwarded.at("/content/body/text").asString()).isEqualTo("Em nhớ anh.");
        assertThat(forwarded.at("/senderId").asString()).isEqualTo(lucas.toString());
        assertThat(forwarded.at("/translation/targetLanguage").asString()).isEqualTo("es-ES");
        UUID emma = data.user("emma", "en-US");
        UUID notMine = steps.direct(cam, emma);
        mvc.perform(withJson(post("/api/messages/" + id + "/forward"), Map.of("conversationIds", List.of(notMine))).with(as(lucas)))
                .andExpect(status().isForbidden());
    }

    @Test
    void muteIsPerMember() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        mvc.perform(withJson(put("/api/conversations/" + conversation + "/mute"), Map.of("muted", true)).with(as(lucas)))
                .andExpect(jsonPath("$.mutedUntil").isNotEmpty());
        mvc.perform(get("/api/conversations/" + conversation).with(as(cam))).andExpect(jsonPath("$.mutedUntil").isEmpty());
        mvc.perform(withJson(put("/api/conversations/" + conversation + "/mute"), Map.of("muted", false)).with(as(lucas)))
                .andExpect(jsonPath("$.mutedUntil").isEmpty());
    }

    @Test
    void eachPersonCreatesAtMostOneGroup() throws Exception {
        UUID emma = data.user("emma", "en-US");
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", " Intercâmbio ", "memberIds", List.of(cam, sofia))).with(as(lucas)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("group"))
                .andExpect(jsonPath("$.title").value("Intercâmbio"))
                .andExpect(jsonPath("$.members", hasSize(3)));
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", "Outro", "memberIds", List.of(cam, emma))).with(as(lucas)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail").value("You can create only one group."));
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", "Cam's", "memberIds", List.of(lucas, emma))).with(as(cam)))
                .andExpect(status().isOk());
    }

    @Test
    void groupsValidateNameAndMembers() throws Exception {
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", " ", "memberIds", List.of(cam, sofia))).with(as(lucas)))
                .andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", "Duo", "memberIds", List.of(cam, lucas))).with(as(lucas)))
                .andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/conversations/groups"), Map.of("title", "X", "memberIds", List.of(cam, UUID.randomUUID()))).with(as(lucas)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void groupMessagesFanOutToEveryLanguage() throws Exception {
        UUID group = UUID.fromString(steps.read(mvc.perform(withJson(post("/api/conversations/groups"),
                        Map.of("title", "Trio", "memberIds", List.of(cam, sofia))).with(as(lucas)))
                .andReturn().getResponse().getContentAsString()).get("id").asString());
        JsonNode sent = steps.send(lucas, group, "Obrigado!");
        assertThat(sent.get("translation").isNull()).isTrue();
        List<String> targets = jdbc.sql("SELECT target_language FROM translation_jobs ORDER BY target_language").query(String.class).list();
        assertThat(targets).containsExactly("es-ES", "vi-VN");
        assertThat(steps.lastMessage(sofia, group).at("/translation/targetLanguage").asString()).isEqualTo("es-ES");
    }

    @Test
    void switchingTheReceivingLanguageQueuesNewTranslationsOnRead() throws Exception {
        UUID conversation = steps.direct(lucas, cam);
        steps.send(cam, conversation, "Chào anh");
        data.setPreference(lucas, "receiving_language", "en-US");
        JsonNode message = steps.lastMessage(lucas, conversation);
        assertThat(message.at("/translation/targetLanguage").asString()).isEqualTo("en-US");
        assertThat(message.at("/translation/status").asString()).isEqualTo("pending");
        assertThat(count("SELECT count(*) FROM translation_jobs WHERE target_language = 'en-US'")).isOne();
    }
}
