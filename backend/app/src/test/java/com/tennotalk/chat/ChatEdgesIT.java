package com.tennotalk.chat;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.test.web.servlet.ResultActions;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;

/** Corners of messaging and posting that ChatIT/FeedIT do not reach (PLAN.md §13, §31.1). */
class ChatEdgesIT extends IntegrationTest {

    private UUID rafael;
    private UUID linh;
    private UUID emma;

    @BeforeEach
    void people() {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
        emma = data.user("emma", "en-US");
    }

    private static int status(ResultActions actions) {
        return actions.andReturn().getResponse().getStatus();
    }

    private ResultActions send(UUID sender, UUID conversation, String clientId, List<UUID> media, String text) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>(Map.of("clientId", clientId, "mediaIds", media));
        if (text != null) body.put("text", text);
        return api.post(sender, "/api/conversations/" + conversation + "/messages", body);
    }

    // ---- Idempotency keys belong to one target ----

    @Test
    void aMessageIdReusedInAnotherConversationIsAConflict() throws Exception {
        UUID withLinh = steps.direct(rafael, linh), withEmma = steps.direct(rafael, emma);
        steps.send(rafael, withLinh, "Oi", "same-key");
        assertThat(status(send(rafael, withEmma, "same-key", List.of(), "Oi"))).isEqualTo(409);
        assertThat(steps.messages(emma, withEmma).get("items").size()).isZero();
    }

    @Test
    void aCommentIdReusedOnAnotherPostIsAConflict() throws Exception {
        String first = actions.post(linh), second = actions.post(linh);
        api.post(rafael, "/api/posts/" + first + "/comments", Map.of("text", "Lindo", "clientId", "same-key")).andReturn();
        assertThat(status(api.post(rafael, "/api/posts/" + second + "/comments", Map.of("text", "Lindo", "clientId", "same-key"))))
                .isEqualTo(409);
    }

    // ---- What a message is made of ----

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "one photo            | image         | 200 | image",
            "three photos         | image,image,image | 200 | image",
            "one video            | video         | 200 | video",
            "one file             | file          | 200 | file",
            "a photo and a video  | image,video   | 400 | ",
            "two videos           | video,video   | 400 | ",
            "a video and a file   | video,file    | 400 | ",
    })
    void attachmentsDecideTheMessageType(String name, String kinds, int expected, String type) throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        List<UUID> media = new ArrayList<>();
        for (String kind : kinds.split(",")) media.add(data.media(rafael, kind.strip()));
        ResultActions result = send(rafael, conversation, "k-" + name.replace(' ', '-'), media, null);
        assertThat(status(result)).isEqualTo(expected);
        if (expected == 200) assertThat(api.ok(result).at("/content/type").asString()).isEqualTo(type);
    }

    // ---- Forwarding ----

    @Test
    void aForwardedStoryReplyArrivesAsPlainText() throws Exception {
        String story = actions.story(linh);
        api.post(rafael, "/api/stories/" + story + "/replies", Map.of("text", "Que lindo!")).andReturn();
        UUID withLinh = UUID.fromString(steps.conversations(rafael).get(0).get("id").asString());
        String reply = steps.lastMessage(rafael, withLinh).get("id").asString();
        UUID withEmma = steps.direct(rafael, emma);

        api.post(rafael, "/api/messages/" + reply + "/forward", Map.of("conversationIds", List.of(withEmma))).andReturn();

        JsonNode copy = steps.lastMessage(emma, withEmma);
        assertThat(copy.at("/content/type").asString()).isEqualTo("text");
        assertThat(copy.at("/content/body/text").asString()).isEqualTo("Que lindo!");
    }

    @Test
    void aForwardedPhotoCanBeOpenedByTheNewConversationOnly() throws Exception {
        UUID photo = actions.upload(rafael);
        UUID withLinh = steps.direct(rafael, linh), withEmma = steps.direct(rafael, emma);
        UUID stranger = data.user("stranger", "en-US");
        String original = api.ok(send(rafael, withLinh, "photo", List.of(photo), null)).get("id").asString();

        api.post(rafael, "/api/messages/" + original + "/forward", Map.of("conversationIds", List.of(withEmma))).andReturn();

        assertThat(steps.lastMessage(emma, withEmma).at("/content/type").asString()).isEqualTo("image");
        assertThat(status(api.get(emma, "/api/media/" + photo))).as("new conversation").isEqualTo(200);
        assertThat(status(api.get(linh, "/api/media/" + photo))).as("original conversation").isEqualTo(200);
        assertThat(status(api.get(stranger, "/api/media/" + photo))).as("nobody else").isEqualTo(404);
    }

    @Test
    void forwardingTwiceToTheSameConversationInOneRequestSendsOneCopy() throws Exception {
        UUID withLinh = steps.direct(rafael, linh), withEmma = steps.direct(rafael, emma);
        String original = steps.send(rafael, withLinh, "Oi").get("id").asString();
        api.post(rafael, "/api/messages/" + original + "/forward", Map.of("conversationIds", List.of(withEmma, withEmma))).andReturn();
        assertThat(steps.messages(emma, withEmma).get("items").size()).isOne();
    }

    // ---- Opening a direct conversation that already exists ----

    @Test
    void anExistingConversationStaysReachableWithTheReasonWhenMessagingIsClosed() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        steps.send(rafael, conversation, "Oi");
        data.setPreference(linh, "who_can_message", "nobody");

        JsonNode reopened = api.postOk(rafael, "/api/conversations/direct", Map.of("userId", linh));
        assertThat(reopened.get("id").asString()).isEqualTo(conversation.toString());
        assertThat(reopened.get("sendRestriction").asString()).isEqualTo("unavailable");
        assertThat(status(api.post(emma, "/api/conversations/direct", Map.of("userId", linh)))).as("a new one is refused").isEqualTo(403);
    }

    @Test
    void anExistingConversationWithABlockIsNotReopenedThroughDirect() throws Exception {
        steps.direct(rafael, linh);
        data.block(linh, rafael);
        assertThat(status(api.post(rafael, "/api/conversations/direct", Map.of("userId", linh)))).isEqualTo(403);
        assertThat(steps.conversations(rafael).size()).as("but it stays in the list").isOne();
    }

    // ---- Reactions don't cross a block (PLAN.md §31.1) ----

    @ParameterizedTest(name = "blocked by {0}")
    @CsvSource({"the reactor", "the author"})
    void nobodyReactsInADirectConversationWithABlock(String blocker) throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        String fromRafael = steps.send(rafael, conversation, "Oi").get("id").asString();
        if (blocker.equals("the reactor")) data.block(linh, rafael);
        else data.block(rafael, linh);

        assertThat(status(api.post(linh, "/api/messages/" + fromRafael + "/reactions", Map.of("emoji", "❤️")))).isEqualTo(403);
        assertThat(steps.lastMessage(rafael, conversation).get("reactions").size()).isZero();
    }

    @Test
    void inAGroupABlockedPairCanStillReact() throws Exception {
        UUID group = UUID.fromString(api.postOk(emma, "/api/conversations/groups",
                Map.of("title", "Trio", "memberIds", List.of(rafael, linh))).get("id").asString());
        String fromRafael = steps.send(rafael, group, "Oi").get("id").asString();
        data.block(linh, rafael);
        assertThat(status(api.post(linh, "/api/messages/" + fromRafael + "/reactions", Map.of("emoji", "❤️")))).isEqualTo(200);
    }

    // ---- A profile's posts, page by page ----

    @Test
    void aProfilesPostsPageWithoutGapsOrRepeats() throws Exception {
        Set<String> created = new HashSet<>();
        for (int n = 0; n < 23; n++) created.add(actions.post(linh));
        List<String> seen = new ArrayList<>();
        String cursor = null;
        for (int page = 0; page < 5; page++) {
            JsonNode body = api.getOk(rafael, "/api/users/" + linh + "/posts" + (cursor == null ? "" : "?cursor=" + cursor));
            body.get("items").forEach(item -> seen.add(item.get("id").asString()));
            if (body.get("nextCursor").isNull()) break;
            cursor = body.get("nextCursor").asString();
        }
        assertThat(seen).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(created);
    }
}
