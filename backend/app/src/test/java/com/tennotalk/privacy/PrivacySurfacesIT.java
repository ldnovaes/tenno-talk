package com.tennotalk.privacy;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.test.web.servlet.ResultActions;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The surfaces PrivacyMatrixIT does not reach (PLAN.md §31.1), for every relation, including a block in both
 * directions, and both profile visibilities: single post, comments, unliking, a story and its view and reaction,
 * the Feed and stories tray (followed accounts only, PLANO_UX.md §10.1), Discover, media downloads, content
 * translation, reports, suggestions, forwarding and an existing group. Viewer and owner always share a group, which
 * must change nothing but the group itself.
 */
class PrivacySurfacesIT extends IntegrationTest {

    record Case(Relation relation, String visibility) {
        boolean contentVisible() { return !relation.blocked() && ("public".equals(visibility) || relation.viewerFollowsOwner()); }

        /** Feed and stories tray: own and followed accounts only, never strangers' public content. */
        boolean inFollowingSurfaces() { return contentVisible() && relation.viewerFollowsOwner(); }

        String blockStatus() {
            return switch (relation) {
                // Own block first: it is the one the viewer can undo.
                case I_BLOCKED, MUTUAL_BLOCK -> "blocked_by_me";
                case BLOCKED_ME -> "blocked_me";
                default -> "none";
            };
        }

        String restriction() {
            if (relation == Relation.I_BLOCKED || relation == Relation.MUTUAL_BLOCK) return "you_blocked";
            if (relation == Relation.BLOCKED_ME) return "unavailable";
            return null; // the owner keeps "everyone" here; settings are PrivacyMatrixIT's axes
        }

        @Override
        public String toString() {
            return relation + " " + visibility;
        }
    }

    static Stream<Case> cases() {
        List<Case> cases = new ArrayList<>();
        for (Relation relation : Relation.values())
            for (String visibility : List.of("public", "private"))
                if (relation.possibleWith(visibility)) cases.add(new Case(relation, visibility));
        return cases.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("cases")
    void everyOtherSurfaceFollowsTheMatrix(Case c) throws Exception {
        UUID owner = data.user("owner", "pt-BR"), viewer = data.user("viewer", "en-US"), third = data.user("third", "es-ES");
        UUID postMedia = actions.upload(owner), storyMedia = actions.upload(owner);
        String post = api.postOk(owner, "/api/posts", Map.of("mediaIds", List.of(postMedia), "caption", "Olá do Rio")).get("id").asString();
        String story = api.postOk(owner, "/api/stories", Map.of("mediaId", storyMedia, "text", "Bom dia")).get("id").asString();
        UUID group = UUID.fromString(api.postOk(third, "/api/conversations/groups",
                Map.of("title", "Trio", "memberIds", List.of(owner, viewer))).get("id").asString());
        UUID withThird = steps.direct(viewer, third);
        String toForward = steps.send(viewer, withThird, "Look").get("id").asString();
        UUID direct = data.directConversation(viewer, owner);
        data.setPreference(owner, "profile_visibility", c.visibility());
        c.relation().arrange(data, viewer, owner);
        boolean visible = c.contentVisible();

        // Profile and lists
        assertThat(api.getOk(viewer, "/api/profiles/owner").get("blockStatus").asString()).as("blockStatus").isEqualTo(c.blockStatus());
        assertThat(ids(api.getOk(viewer, "/api/people/suggestions?limit=50"))).as("suggestions")
                .matches(list -> !c.relation().blocked() || !list.contains(owner.toString()));

        // A post: open, comments, unlike, its media, translation and reporting
        assertThat(status(api.get(viewer, "/api/posts/" + post))).as("open the post").isEqualTo(visible ? 200 : 404);
        assertThat(status(api.get(viewer, "/api/posts/" + post + "/comments"))).as("read comments").isEqualTo(visible ? 200 : 404);
        assertThat(ok(api.delete(viewer, "/api/posts/" + post + "/like"))).as("unlike").isEqualTo(visible);
        assertThat(status(api.get(viewer, "/api/media/" + postMedia))).as("post photo").isEqualTo(visible ? 200 : 404);
        assertThat(ok(api.post(viewer, "/api/translations/post/" + post + "?lang=en-US", null))).as("translate the caption").isEqualTo(visible);
        assertThat(ok(api.post(viewer, "/api/reports", Map.of("targetKind", "post", "targetId", post, "reason", "spam"))))
                .as("report the post").isEqualTo(visible);

        // A story: open, its photo, view, react, translate, report
        assertThat(status(api.get(viewer, "/api/stories/" + story))).as("open the story").isEqualTo(visible ? 200 : 404);
        assertThat(status(api.get(viewer, "/api/media/" + storyMedia))).as("story photo").isEqualTo(visible ? 200 : 404);
        assertThat(ok(api.put(viewer, "/api/stories/" + story + "/view"))).as("view the story").isEqualTo(visible);
        assertThat(ok(api.post(viewer, "/api/stories/" + story + "/reactions", Map.of("emoji", "🔥")))).as("react").isEqualTo(visible);
        assertThat(ok(api.post(viewer, "/api/translations/story/" + story + "?lang=en-US", null))).as("translate the story").isEqualTo(visible);
        assertThat(ok(api.post(viewer, "/api/reports", Map.of("targetKind", "story", "targetId", story, "reason", "spam"))))
                .as("report the story").isEqualTo(visible);

        // Following surfaces and Discover
        assertThat(authorsIn(api.getOk(viewer, "/api/feed").get("items"))).as("feed")
                .matches(authors -> authors.contains(owner.toString()) == c.inFollowingSurfaces());
        assertThat(ids(api.getOk(viewer, "/api/stories/tray"), "/user/id")).as("stories tray")
                .matches(users -> users.contains(owner.toString()) == c.inFollowingSurfaces());
        assertThat(authorsIn(api.getOk(viewer, "/api/discover").get("items"))).as("discover never shows hidden content")
                .matches(authors -> visible || !authors.contains(owner.toString()));

        // Messaging: forward into the direct conversation, and the group they share
        assertThat(ok(api.post(viewer, "/api/messages/" + toForward + "/forward", Map.of("conversationIds", List.of(direct)))))
                .as("forward to the owner").isEqualTo(c.restriction() == null);
        assertThat(ok(api.post(viewer, "/api/conversations/" + group + "/messages",
                Map.of("clientId", "group-" + c, "text", "Oi, grupo", "mediaIds", List.of()))))
                .as("an existing group still reaches everyone").isTrue();
    }

    // ---- helpers -----------------------------------------------------------

    private static int status(ResultActions actions) {
        return actions.andReturn().getResponse().getStatus();
    }

    /** 2xx; and when refused, refused as "not there" (404) or "not allowed" (403), never a server error. */
    private static boolean ok(ResultActions actions) {
        int status = status(actions);
        assertThat(status).as("a refusal is a client error").isIn(200, 201, 204, 403, 404);
        return status < 300;
    }

    private static List<String> ids(JsonNode list) {
        return ids(list, "/id");
    }

    private static List<String> ids(JsonNode list, String pointer) {
        List<String> ids = new ArrayList<>();
        for (JsonNode item : list) ids.add(item.at(pointer).asString());
        return ids;
    }

    private static List<String> authorsIn(JsonNode posts) {
        return ids(posts, "/author/id");
    }
}
