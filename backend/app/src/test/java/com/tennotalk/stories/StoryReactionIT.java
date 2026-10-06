package com.tennotalk.stories;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.test.web.servlet.ResultActions;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;

/** Reacting to a story is a direct message, like Instagram (PLAN.md §9.9). */
class StoryReactionIT extends IntegrationTest {

    private UUID rafael;
    private UUID linh;
    private String story;

    @BeforeEach
    void people() throws Exception {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
        story = actions.story(linh);
    }

    private ResultActions react(UUID who, String emoji, String clientId) throws Exception {
        Map<String, Object> body = clientId == null ? Map.of("emoji", emoji) : Map.of("emoji", emoji, "clientId", clientId);
        return api.post(who, "/api/stories/" + story + "/reactions", body);
    }

    private static int status(ResultActions actions) {
        return actions.andReturn().getResponse().getStatus();
    }

    @Test
    void theReactionArrivesInTheConversationWithTheAuthor() throws Exception {
        JsonNode result = api.ok(react(rafael, "🔥", null));
        UUID conversation = UUID.fromString(result.get("conversationId").asString());

        JsonNode message = steps.lastMessage(linh, conversation);
        assertThat(message.at("/content/type").asString()).isEqualTo("story_reaction");
        assertThat(message.at("/content/emoji").asString()).isEqualTo("🔥");
        assertThat(message.at("/content/storyId").asString()).isEqualTo(story);
        assertThat(message.get("translation").isNull()).as("an emoji is not translated").isTrue();
        assertThat(result.at("/message/id").asString()).isEqualTo(message.get("id").asString());
        assertThat(jdbc.sql("SELECT count(*) FROM translation_jobs").query(Long.class).single()).isZero();
    }

    @Test
    void theAuthorIsToldLikeForAnyMessageAndNothingMore() throws Exception {
        react(rafael, "🔥", null);
        JsonNode notifications = api.getOk(linh, "/api/notifications");
        assertThat(notifications.findValuesAsString("type")).containsExactly("new_message");
        assertThat(api.getOk(linh, "/api/conversations").get(0).get("unreadCount").asInt()).isOne();
    }

    @Test
    void everyTapIsANewMessageButARetriedTapIsNot() throws Exception {
        react(rafael, "🔥", "tap-1");
        react(rafael, "🔥", "tap-1");
        JsonNode third = api.ok(react(rafael, "😂", "tap-2"));
        UUID conversation = UUID.fromString(third.get("conversationId").asString());
        assertThat(steps.messages(linh, conversation).get("items").size()).isEqualTo(2);
    }

    @Test
    void itReusesTheExistingConversation() throws Exception {
        UUID conversation = steps.direct(rafael, linh);
        steps.send(rafael, conversation, "Oi");
        JsonNode result = api.ok(react(rafael, "❤️", null));
        assertThat(result.get("conversationId").asString()).isEqualTo(conversation.toString());
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource({
            "the author accepts nobody, nobody, 403",
            "the author accepts people they follow, followers, 403",
            "the author accepts everyone, everyone, 200",
    })
    void messagingPrivacyApplies(String name, String audience, int expected) throws Exception {
        data.setPreference(linh, "who_can_message", audience);
        assertThat(status(react(rafael, "🔥", null))).isEqualTo(expected);
    }

    @Test
    void youCantReactToYourOwnStory() throws Exception {
        assertThat(status(react(linh, "🔥", null))).isEqualTo(400);
    }

    @Test
    void aStoryYouCantSeeCantBeReactedTo() throws Exception {
        data.block(linh, rafael);
        assertThat(status(react(rafael, "🔥", null))).isEqualTo(404);
        jdbc.sql("DELETE FROM blocks").update();
        jdbc.sql("UPDATE stories SET expires_at = now() - interval '1 minute'").update();
        assertThat(status(react(rafael, "🔥", null))).as("expired").isEqualTo(404);
    }

    @Test
    void aForwardedReactionBecomesPlainText() throws Exception {
        JsonNode result = api.ok(react(rafael, "🔥", null));
        UUID emma = data.user("emma", "en-US");
        UUID withEmma = steps.direct(rafael, emma);
        api.post(rafael, "/api/messages/" + result.at("/message/id").asString() + "/forward",
                Map.of("conversationIds", java.util.List.of(withEmma))).andReturn();
        assertThat(steps.lastMessage(emma, withEmma).at("/content/type").asString()).isEqualTo("text");
    }
}
