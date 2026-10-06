package com.tennotalk.privacy;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.test.web.servlet.ResultActions;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The privacy matrix of PLAN.md §31.1, verified through the HTTP API: every relation between a viewer and an
 * owner, crossed with every value of the owner's privacy settings. The expected outcome of each surface comes from
 * a small oracle written here, independently of the production code. The same cases run against the mock backend in
 * src/services/mock/__tests__/privacyMatrix.test.ts.
 */
class PrivacyMatrixIT extends IntegrationTest {

    /** The 8 relations of the original matrix (MUTUAL_BLOCK is covered by PrivacySurfacesIT). */
    private static final List<Relation> RELATIONS = List.of(Relation.STRANGER, Relation.I_FOLLOW, Relation.FOLLOWS_ME,
            Relation.MUTUAL, Relation.I_REQUESTED, Relation.OWNER_REQUESTED, Relation.I_BLOCKED, Relation.BLOCKED_ME);

    private static final List<String> AUDIENCES = List.of("everyone", "followers", "nobody");

    /** The owner's settings and how the viewer relates to the owner. */
    record Case(Relation relation, String visibility, String message, String comment, String online) {

        boolean blocked() { return relation.blocked(); }

        boolean ownerFollowsViewer() { return relation.ownerFollowsViewer(); }

        boolean viewerFollowsOwner() { return relation.viewerFollowsOwner(); }

        boolean contentVisible() { return !blocked() && ("public".equals(visibility) || viewerFollowsOwner()); }

        boolean commentAllowed() {
            return "everyone".equals(comment) || ("followers".equals(comment) && ownerFollowsViewer());
        }

        boolean presenceVisible() {
            return !blocked() && ("everyone".equals(online) || ("followers".equals(online) && ownerFollowsViewer()));
        }

        /** Why the viewer can't message the owner directly, or null. */
        String restriction() {
            if (relation == Relation.I_BLOCKED) return "you_blocked";
            if (relation == Relation.BLOCKED_ME || "nobody".equals(message)) return "unavailable";
            if ("followers".equals(message) && !ownerFollowsViewer() && relation != Relation.OWNER_REQUESTED) return "followers_only";
            return null;
        }

        String blockStatus() {
            return switch (relation) {
                case I_BLOCKED -> "blocked_by_me";
                case BLOCKED_ME -> "blocked_me";
                default -> "none";
            };
        }
    }

    static Stream<Case> cases() {
        List<Case> cases = new ArrayList<>();
        for (Relation relation : RELATIONS)
            for (String visibility : List.of("public", "private"))
                for (String message : AUDIENCES)
                    for (String comment : AUDIENCES)
                        for (String online : AUDIENCES) {
                            if (!relation.possibleWith(visibility)) continue;
                            cases.add(new Case(relation, visibility, message, comment, online));
                        }
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("cases")
    void everySurfaceFollowsTheMatrix(Case c) throws Exception {
        UUID owner = data.user("owner", "pt-BR"), viewer = data.user("viewer", "en"), third = data.user("third", "es");
        jdbc.sql("UPDATE users SET bio = 'Owner bio' WHERE id = :id").param("id", owner).update();
        data.lastSeen(owner, Instant.parse("2026-10-05T10:00:00Z"));
        UUID post = id(api.postOk(owner, "/api/posts", Map.of("mediaIds", List.of(data.media(owner, "image")))));
        UUID story = id(api.postOk(owner, "/api/stories", Map.of("mediaId", data.media(owner, "image"))));
        data.setPreference(owner, "profile_visibility", c.visibility());
        data.setPreference(owner, "who_can_message", c.message());
        data.setPreference(owner, "who_can_comment", c.comment());
        data.setPreference(owner, "who_can_see_online", c.online());
        c.relation().arrange(data, viewer, owner);

        // Profile
        JsonNode profile = api.getOk(viewer, "/api/profiles/owner");
        assertThat(profile.get("blockStatus").asString()).isEqualTo(c.blockStatus());
        assertThat(isNull(profile, "lastSeenAt")).as("presence on the profile").isEqualTo(!c.presenceVisible());
        boolean minimal = c.relation() == Relation.BLOCKED_ME;
        assertThat(isNull(profile, "bio")).as("bio").isEqualTo(minimal);
        assertThat(profile.get("postsCount").asLong()).as("posts count").isEqualTo(minimal ? 0 : 1);

        // Search
        JsonNode found = find(api.getOk(viewer, "/api/people/search?q=owner"), owner);
        assertThat(found != null).as("listed in search").isEqualTo(!c.blocked());
        if (found != null) assertThat(isNull(found, "lastSeenAt")).as("presence in search").isEqualTo(!c.presenceVisible());

        // Content
        assertThat(api.getOk(viewer, "/api/users/" + owner + "/posts").get("items").size()).as("posts").isEqualTo(c.contentVisible() ? 1 : 0);
        assertThat(api.getOk(viewer, "/api/stories/by-user/" + owner).size()).as("stories").isEqualTo(c.contentVisible() ? 1 : 0);
        assertThat(status(api.put(viewer, "/api/posts/" + post + "/like"))).as("like").isEqualTo(c.contentVisible() ? 200 : 404);
        assertThat(status(api.post(viewer, "/api/posts/" + post + "/comments", Map.of("text", "Nice"))))
                .as("comment").isEqualTo(!c.contentVisible() ? 404 : c.commentAllowed() ? 200 : 403);

        // Messaging: starting, the conversation listing, sending, story replies and groups
        String restriction = c.restriction();
        int start = status(api.post(viewer, "/api/conversations/direct", Map.of("userId", owner)));
        assertThat(start).as("start a conversation").isEqualTo(restriction == null ? 200 : 403);
        if (start != 200) data.directConversation(owner, viewer);
        JsonNode conversation = steps.conversations(viewer).get(0);
        assertThat(nullableText(conversation, "sendRestriction")).as("send restriction").isEqualTo(restriction);
        assertThat(isNull(member(conversation, owner), "lastSeenAt")).as("presence in the conversation").isEqualTo(!c.presenceVisible());
        UUID conversationId = id(conversation);
        assertThat(status(api.post(viewer, "/api/conversations/" + conversationId + "/messages",
                Map.of("clientId", "matrix", "text", "Oi", "mediaIds", List.of()))))
                .as("send").isEqualTo(restriction == null ? 200 : 403);
        assertThat(status(api.post(viewer, "/api/stories/" + story + "/replies", Map.of("text", "Wow"))))
                .as("story reply").isEqualTo(!c.contentVisible() ? 404 : restriction == null ? 200 : 403);
        assertThat(status(api.post(viewer, "/api/conversations/groups", Map.of("title", "Trio", "memberIds", List.of(owner, third)))))
                .as("add to a group").isEqualTo(restriction == null ? 200 : 400);
    }

    /** Production, 2026-10-05: unblocking left "People I follow" refusing in silence. */
    @Test
    void afterUnblockingTheConversationSaysWhyAndAFollowBackReopensIt() throws Exception {
        UUID caladris = data.user("caladris", "pt-BR"), teste = data.user("teste", "pt-BR");
        data.setPreference(caladris, "who_can_message", "followers");
        data.follow(caladris, teste);
        UUID conversation = steps.direct(teste, caladris);
        api.put(teste, "/api/profiles/" + caladris + "/block");
        assertThat(restrictionOf(teste, conversation)).isEqualTo("you_blocked");
        assertThat(restrictionOf(caladris, conversation)).isEqualTo("unavailable");

        api.delete(teste, "/api/profiles/" + caladris + "/block");

        assertThat(restrictionOf(teste, conversation)).isEqualTo("followers_only");
        assertThat(status(api.post(teste, "/api/conversations/" + conversation + "/messages",
                Map.of("clientId", "after-unblock", "text", "oi", "mediaIds", List.of())))).isEqualTo(403);
        api.put(caladris, "/api/profiles/" + teste + "/follow");
        assertThat(restrictionOf(teste, conversation)).isNull();
        steps.send(teste, conversation, "oi de novo");
    }

    /** Production, 2026-10-05: a private sender couldn't reach "People I follow" while the follow back was pending. */
    @Test
    void aPendingFollowBackLetsAPrivateSenderMessage() throws Exception {
        UUID caladris = data.user("caladris", "pt-BR"), teste = data.user("teste", "pt-BR");
        data.setPreference(caladris, "who_can_message", "followers");
        data.setPreference(teste, "profile_visibility", "private");
        UUID conversation = data.directConversation(teste, caladris);
        assertThat(restrictionOf(teste, conversation)).isEqualTo("followers_only");

        api.put(caladris, "/api/profiles/" + teste + "/follow"); // becomes a request: teste is private
        assertThat(restrictionOf(teste, conversation)).isNull();
        steps.send(teste, conversation, "hi");

        api.delete(teste, "/api/me/follow-requests/" + caladris); // rejected: the interest is gone
        assertThat(restrictionOf(teste, conversation)).isEqualTo("followers_only");

        api.put(caladris, "/api/profiles/" + teste + "/follow");
        api.post(teste, "/api/me/follow-requests/" + caladris + "/approve", null);
        assertThat(restrictionOf(teste, conversation)).isNull();
        steps.send(teste, conversation, "oi");
    }

    @Test
    void goingPublicTurnsPendingRequestsIntoFollowsThatShowContent() throws Exception {
        UUID owner = data.user("owner", "pt-BR"), viewer = data.user("viewer", "en");
        data.setPreference(owner, "profile_visibility", "private");
        api.postOk(owner, "/api/posts", Map.of("mediaIds", List.of(data.media(owner, "image"))));
        api.put(viewer, "/api/profiles/" + owner + "/follow");
        assertThat(api.getOk(viewer, "/api/users/" + owner + "/posts").get("items").size()).isZero();

        api.patch(owner, "/api/me/preferences", Map.of("privacy", Map.of("profileVisibility", "public")));

        assertThat(api.getOk(viewer, "/api/profiles/owner").get("isFollowing").asBoolean()).isTrue();
        assertThat(api.getOk(viewer, "/api/users/" + owner + "/posts").get("items").size()).isOne();
    }

    // ---- helpers -----------------------------------------------------------

    private String restrictionOf(UUID viewer, UUID conversation) throws Exception {
        return nullableText(api.getOk(viewer, "/api/conversations/" + conversation), "sendRestriction");
    }

    private static int status(ResultActions actions) {
        return actions.andReturn().getResponse().getStatus();
    }

    private static UUID id(JsonNode node) {
        return UUID.fromString(node.get("id").asString());
    }

    private static boolean isNull(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNull() || value.isMissingNode();
    }

    private static String nullableText(JsonNode node, String field) {
        return isNull(node, field) ? null : node.get(field).asString();
    }

    private static JsonNode find(JsonNode list, UUID user) {
        for (JsonNode item : list) if (item.get("id").asString().equals(user.toString())) return item;
        return null;
    }

    private static JsonNode member(JsonNode conversation, UUID user) {
        for (JsonNode member : conversation.get("members")) {
            if (member.at("/user/id").asString().equals(user.toString())) return member;
        }
        throw new AssertionError("Not a member: " + user);
    }
}
