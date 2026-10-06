package com.tennotalk.notifications;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.FieldSource;
import org.junit.jupiter.params.provider.MethodSource;

import com.tennotalk.support.Actions;
import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Who gets which notification (PLAN.md §31.1 "Notificações e push", PLANO_UX.md §8): every type × the recipient's
 * switch, blocks in either direction (old notifications hidden while the block lasts), your own actions, paging,
 * reading individually, by conversation and all at once, and follow requests withdrawn when they stop applying.
 */
class NotificationMatrixIT extends IntegrationTest {

    private UUID owner;
    private UUID actor;

    @BeforeEach
    void people() {
        owner = data.user("owner", "pt-BR");
        actor = data.user("ana", "es-ES");
    }

    private JsonNode list(UUID user) throws Exception {
        return api.getOk(user, "/api/notifications");
    }

    private long unread(UUID user) throws Exception {
        return api.getOk(user, "/api/notifications/unread-count").get("count").asLong();
    }

    static Stream<Arguments> typeAndSwitch() {
        List<Arguments> rows = new ArrayList<>();
        for (String type : Actions.NOTIFICATION_TYPES) {
            rows.add(Arguments.of(type, true));
            rows.add(Arguments.of(type, false));
        }
        return rows.stream();
    }

    @ParameterizedTest(name = "{0}, switch on={1}")
    @MethodSource("typeAndSwitch")
    void eachTypeRespectsTheRecipientsSwitch(String type, boolean on) throws Exception {
        data.setPreference(owner, Actions.preferenceOf(type), on);
        var notification = actions.notify(actor, owner, type);

        assertThat(notification.isPresent()).isEqualTo(on);
        JsonNode items = list(owner);
        assertThat(items.size()).isEqualTo(on ? 1 : 0);
        assertThat(unread(owner)).isEqualTo(on ? 1 : 0);
        if (on) {
            assertThat(items.get(0).get("type").asString()).isEqualTo(type);
            assertThat(items.get(0).get("actor").get("id").asString()).isEqualTo(actor.toString());
        }
        assertThat(list(actor).size()).as("the actor is never notified of their own action").isZero();
    }

    static Stream<Arguments> typeAndBlocker() {
        List<Arguments> rows = new ArrayList<>();
        for (String type : Actions.NOTIFICATION_TYPES) {
            rows.add(Arguments.of(type, "recipient"));
            rows.add(Arguments.of(type, "actor"));
        }
        return rows.stream();
    }

    @ParameterizedTest(name = "{0}, blocked by the {1} afterwards")
    @MethodSource("typeAndBlocker")
    void aBlockHidesOldNotificationsAndUnblockingDoesNotResurrectThem(String type, String blocker) throws Exception {
        actions.notify(actor, owner, type).orElseThrow();
        UUID who = blocker.equals("recipient") ? owner : actor;
        UUID whom = blocker.equals("recipient") ? actor : owner;
        api.put(who, "/api/profiles/" + whom + "/block").andExpect(status().is2xxSuccessful());

        assertThat(list(owner).size()).isZero();
        assertThat(unread(owner)).isZero();

        // Follow requests are deleted by the block (they no longer apply); the others come back hidden-then-shown.
        api.delete(who, "/api/profiles/" + whom + "/block").andExpect(status().is2xxSuccessful());
        long expected = type.equals("follow_request") ? 0 : 1;
        assertThat(list(owner).size()).isEqualTo(expected);
    }

    @ParameterizedTest(name = "{0}")
    @FieldSource("OWN_ACTIONS")
    void yourOwnActionsNeverNotifyYou(String action) throws Exception {
        switch (action) {
            case "like own post" -> api.put(owner, "/api/posts/" + actions.post(owner) + "/like").andExpect(status().is2xxSuccessful());
            case "comment own post" -> api.post(owner, "/api/posts/" + actions.post(owner) + "/comments", Map.of("text", "Oi"))
                    .andExpect(status().is2xxSuccessful());
            case "react to own story" -> api.post(owner, "/api/stories/" + actions.story(owner) + "/reactions", Map.of("emoji", "❤️"));
            default -> throw new IllegalArgumentException(action);
        }
        assertThat(list(owner).size()).isZero();
    }

    static final List<String> OWN_ACTIONS = List.of("like own post", "comment own post", "react to own story");

    @Test
    void aMutedConversationCreatesNoMessageNotification() throws Exception {
        UUID conversation = steps.direct(actor, owner);
        api.mvc().perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/conversations/" + conversation + "/mute")
                        .with(com.tennotalk.support.TestData.as(owner))
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType("application/json").content("{\"muted\":true}"))
                .andExpect(status().is2xxSuccessful());
        steps.send(actor, conversation, "Oi");
        assertThat(list(owner).size()).isZero();
    }

    // ---- Paging and reading ----

    private List<UUID> seed(int count) {
        List<UUID> ids = new ArrayList<>();
        Instant start = Instant.parse("2026-10-01T00:00:00Z");
        for (int n = 0; n < count; n++) {
            UUID id = UUID.randomUUID();
            jdbc.sql("INSERT INTO notifications (id, recipient_id, actor_id, type, created_at) VALUES (:id, :r, :a, 'follow', :at)")
                    .param("id", id).param("r", owner).param("a", actor).param("at", Timestamp.from(start.plusSeconds(n))).update();
            ids.add(id);
        }
        return ids;
    }

    @Test
    void pagesOf100NewestFirstWithoutGapsOrRepeats() throws Exception {
        List<UUID> seeded = seed(230);
        List<String> seen = new ArrayList<>();
        String before = null;
        for (int page = 0; page < 4; page++) {
            JsonNode items = api.getOk(owner, "/api/notifications" + (before == null ? "" : "?beforeId=" + before));
            if (items.isEmpty()) break;
            assertThat(items.size()).isLessThanOrEqualTo(100);
            items.forEach(item -> seen.add(item.get("id").asString()));
            before = items.get(items.size() - 1).get("id").asString();
        }
        List<String> newestFirst = seeded.reversed().stream().map(UUID::toString).toList();
        assertThat(seen).containsExactlyElementsOf(newestFirst);
    }

    @Test
    void aCursorFromSomeoneElsesListGivesNothing() throws Exception {
        UUID other = data.user("other", "en-US");
        seed(3);
        UUID foreign = UUID.randomUUID();
        jdbc.sql("INSERT INTO notifications (id, recipient_id, actor_id, type) VALUES (:id, :r, :a, 'follow')")
                .param("id", foreign).param("r", other).param("a", actor).update();
        assertThat(api.getOk(owner, "/api/notifications?beforeId=" + foreign).size()).isZero();
    }

    @Test
    void readingByIdTouchesOnlyYourOwnNotifications() throws Exception {
        UUID other = data.user("other", "en-US");
        List<UUID> mine = seed(3);
        UUID theirs = UUID.randomUUID();
        jdbc.sql("INSERT INTO notifications (id, recipient_id, actor_id, type) VALUES (:id, :r, :a, 'follow')")
                .param("id", theirs).param("r", other).param("a", actor).update();

        api.post(owner, "/api/notifications/read", Map.of("ids", List.of(mine.get(0), theirs))).andExpect(status().is2xxSuccessful());
        assertThat(unread(owner)).isEqualTo(2);
        assertThat(unread(other)).as("someone else's notification stays unread").isOne();
    }

    @Test
    void readAllDoesNotSwallowANotificationThatArrivesAfterIt() throws Exception {
        seed(2);
        api.post(owner, "/api/notifications/read-all", null).andExpect(status().is2xxSuccessful());
        actions.notify(actor, owner, "follow");
        assertThat(unread(owner)).isOne();
    }

    @Test
    void readingAConversationReadsItsMessageNotificationsUpToThatMessage() throws Exception {
        UUID conversation = steps.direct(actor, owner);
        String first = steps.send(actor, conversation, "1").get("id").asString();
        steps.send(actor, conversation, "2");
        steps.send(actor, conversation, "3");
        assertThat(unread(owner)).isEqualTo(3);

        api.post(owner, "/api/conversations/" + conversation + "/read", Map.of("messageId", first)).andExpect(status().is2xxSuccessful());
        assertThat(unread(owner)).isEqualTo(2);
    }

    // ---- Follow requests withdrawn when they stop applying ----

    @ParameterizedTest(name = "{0}")
    @FieldSource("REQUEST_ENDINGS")
    void aFollowRequestNotificationGoesAwayWhenTheRequestEnds(String ending) throws Exception {
        actions.notify(actor, owner, "follow_request").orElseThrow();
        switch (ending) {
            case "approved" -> api.post(owner, "/api/me/follow-requests/" + actor + "/approve", null).andExpect(status().is2xxSuccessful());
            case "declined" -> api.delete(owner, "/api/me/follow-requests/" + actor).andExpect(status().is2xxSuccessful());
            case "cancelled" -> api.delete(actor, "/api/profiles/" + owner + "/follow").andExpect(status().is2xxSuccessful());
            case "profile made public" -> api.patch(owner, "/api/me/preferences", Map.of("privacy", Map.of("profileVisibility", "public")))
                    .andExpect(status().is2xxSuccessful());
            default -> throw new IllegalArgumentException(ending);
        }
        JsonNode items = list(owner);
        assertThat(items.findValuesAsString("type")).doesNotContain("follow_request");
        boolean becameAFollow = ending.equals("approved") || ending.equals("profile made public");
        long follows = jdbc.sql("SELECT count(*) FROM follows WHERE follower_id = :a AND followee_id = :o")
                .param("a", actor).param("o", owner).query(Long.class).single();
        assertThat(follows).isEqualTo(becameAFollow ? 1 : 0);
    }

    static final List<String> REQUEST_ENDINGS = List.of("approved", "declined", "cancelled", "profile made public");
}
