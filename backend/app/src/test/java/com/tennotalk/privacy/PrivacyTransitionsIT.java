package com.tennotalk.privacy;

import java.time.Instant;
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
 * Privacy changes in the middle of a session (PLAN.md §31.1): after each change every surface agrees with the new
 * state at once, with nothing left over from before. One transition per row; the same snapshot before and after.
 */
class PrivacyTransitionsIT extends IntegrationTest {

    /** What the viewer can do with the owner's things right now. */
    record Snapshot(boolean content, boolean comment, boolean message, boolean presence, boolean feed) {
        static Snapshot of(boolean content, boolean comment, boolean message, boolean presence, boolean feed) {
            return new Snapshot(content, comment, message, presence, feed);
        }
    }

    interface Step {
        void run(PrivacyTransitionsIT test, UUID viewer, UUID owner) throws Exception;
    }

    record Transition(String name, Step before, Step change, Snapshot expectedBefore, Snapshot expectedAfter) {
        @Override
        public String toString() {
            return name;
        }
    }

    private static final Step NOTHING = (t, viewer, owner) -> { };

    private static Step pref(String column, Object value) {
        return (t, viewer, owner) -> t.data.setPreference(owner, column, value);
    }

    private static Step patch(Map<String, Object> privacy) {
        return (t, viewer, owner) -> t.api.patch(owner, "/api/me/preferences", Map.of("privacy", privacy));
    }

    private static Step follow() {
        return (t, viewer, owner) -> t.api.put(viewer, "/api/profiles/" + owner + "/follow");
    }

    private static Step steps(Step... steps) {
        return (t, viewer, owner) -> {
            for (Step step : steps) step.run(t, viewer, owner);
        };
    }

    static Stream<Transition> transitions() {
        Snapshot all = Snapshot.of(true, true, true, true, false);
        Snapshot followingAll = Snapshot.of(true, true, true, true, true);
        Snapshot hidden = Snapshot.of(false, false, true, true, false);
        Snapshot blocked = Snapshot.of(false, false, false, false, false);
        return Stream.of(
                new Transition("public → private hides content from a stranger", NOTHING,
                        patch(Map.of("profileVisibility", "private")), all, hidden),
                new Transition("private → public shows it again", pref("profile_visibility", "private"),
                        patch(Map.of("profileVisibility", "public")), hidden, all),
                new Transition("following a public profile adds it to the feed", NOTHING, follow(), all, followingAll),
                new Transition("unfollowing a private profile hides it", steps(pref("profile_visibility", "private"), follow(),
                        (t, viewer, owner) -> t.api.post(owner, "/api/me/follow-requests/" + viewer + "/approve", null)),
                        (t, viewer, owner) -> t.api.delete(viewer, "/api/profiles/" + owner + "/follow"), followingAll, hidden),
                new Transition("a request does not show anything until approved", steps(pref("profile_visibility", "private"), follow()),
                        (t, viewer, owner) -> t.api.post(owner, "/api/me/follow-requests/" + viewer + "/approve", null),
                        hidden, followingAll),
                new Transition("a declined request shows nothing", steps(pref("profile_visibility", "private"), follow()),
                        (t, viewer, owner) -> t.api.delete(owner, "/api/me/follow-requests/" + viewer), hidden, hidden),
                new Transition("the owner blocks the viewer", follow(),
                        (t, viewer, owner) -> t.api.put(owner, "/api/profiles/" + viewer + "/block"), followingAll, blocked),
                new Transition("the viewer blocks the owner", follow(),
                        (t, viewer, owner) -> t.api.put(viewer, "/api/profiles/" + owner + "/block"), followingAll, blocked),
                new Transition("unblocking does not restore the follow", steps(follow(),
                        (t, viewer, owner) -> t.api.put(viewer, "/api/profiles/" + owner + "/block")),
                        (t, viewer, owner) -> t.api.delete(viewer, "/api/profiles/" + owner + "/block"), blocked, all),
                new Transition("who can message → nobody", NOTHING, patch(Map.of("whoCanMessage", "nobody")),
                        all, Snapshot.of(true, true, false, true, false)),
                new Transition("who can message → people I follow (I don't)", NOTHING, patch(Map.of("whoCanMessage", "followers")),
                        all, Snapshot.of(true, true, false, true, false)),
                new Transition("who can message → people I follow, then I follow back", pref("who_can_message", "followers"),
                        (t, viewer, owner) -> t.api.put(owner, "/api/profiles/" + viewer + "/follow"),
                        Snapshot.of(true, true, false, true, false), all),
                new Transition("who can comment → nobody", NOTHING, patch(Map.of("whoCanComment", "nobody")),
                        all, Snapshot.of(true, false, true, true, false)),
                new Transition("who can see me online → nobody", NOTHING, patch(Map.of("whoCanSeeOnline", "nobody")),
                        all, Snapshot.of(true, true, true, false, false)));
    }

    private Snapshot snapshot(UUID viewer, UUID owner, String post, UUID conversation, int round) throws Exception {
        boolean content = status(api.get(viewer, "/api/posts/" + post)) == 200;
        int comment = status(api.post(viewer, "/api/posts/" + post + "/comments", Map.of("text", "Oi " + round)));
        boolean message = status(api.post(viewer, "/api/conversations/" + conversation + "/messages",
                Map.of("clientId", "transition-" + round, "text", "Oi", "mediaIds", List.of()))) == 200;
        JsonNode profile = api.getOk(viewer, "/api/profiles/owner");
        boolean presence = !profile.path("lastSeenAt").isNull() && !profile.path("lastSeenAt").isMissingNode();
        boolean feed = false;
        for (JsonNode item : api.getOk(viewer, "/api/feed").get("items"))
            feed |= item.at("/author/id").asString().equals(owner.toString());
        return Snapshot.of(content, comment == 200, message, presence, feed);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("transitions")
    void everySurfaceAgreesRightAfterTheChange(Transition transition) throws Exception {
        UUID owner = data.user("owner", "pt-BR"), viewer = data.user("viewer", "en-US");
        data.lastSeen(owner, Instant.parse("2026-10-05T10:00:00Z"));
        String post = api.postOk(owner, "/api/posts", Map.of("mediaIds", List.of(data.media(owner, "image")))).get("id").asString();
        UUID conversation = data.directConversation(viewer, owner);
        transition.before().run(this, viewer, owner);
        assertThat(snapshot(viewer, owner, post, conversation, 1)).as("before").isEqualTo(transition.expectedBefore());

        transition.change().run(this, viewer, owner);

        assertThat(snapshot(viewer, owner, post, conversation, 2)).as("after").isEqualTo(transition.expectedAfter());
        assertThat(steps.conversations(viewer).size()).as("the direct conversation stays listed").isOne();
    }

    private static int status(ResultActions actions) {
        return actions.andReturn().getResponse().getStatus();
    }
}
