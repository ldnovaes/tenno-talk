package com.tennotalk.discovery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

/** Discover against a real PostgreSQL (PLAN.md §37.6): who sees what, in which pages. */
class DiscoverIT extends IntegrationTest {

    @Autowired
    SignalsWorker signals;

    private UUID rafael;
    private UUID linh;

    @BeforeEach
    void people() {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
    }

    private UUID post(UUID author, String caption) throws Exception {
        JsonNode created = api.postOk(author, "/api/posts", Map.of("mediaIds", List.of(data.media(author, "image")), "caption", caption));
        return UUID.fromString(created.get("id").asString());
    }

    private JsonNode page(UUID viewer, String cursor) throws Exception {
        return cursor == null ? api.getOk(viewer, "/api/discover") : api.getOk(viewer, "/api/discover?cursor=" + cursor);
    }

    private static List<String> ids(JsonNode page) {
        List<String> ids = new ArrayList<>();
        page.get("items").forEach(item -> ids.add(item.get("id").asString()));
        return ids;
    }

    /** Every post the viewer can reach by scrolling until the end. */
    private List<String> scrollAll(UUID viewer) throws Exception {
        List<String> all = new ArrayList<>();
        String cursor = null;
        for (int guard = 0; guard < 50; guard++) {
            JsonNode page = page(viewer, cursor);
            all.addAll(ids(page));
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asString();
            if (cursor == null) return all;
        }
        throw new AssertionError("Discover never ended");
    }

    @Test
    void aNewPostReachesSomeoneWhoKnowsNothingAboutItsAuthor() throws Exception {
        UUID post = post(linh, "Xin chào");

        JsonNode page = page(rafael, null);

        assertThat(ids(page)).containsExactly(post.toString());
        assertThat(page.at("/items/0/author/username").asString()).isEqualTo("linh");
        assertThat(page.at("/items/0/caption/text").asString()).isEqualTo("Xin chào");
    }

    @Test
    void ownPostsAreNotDiscovered() throws Exception {
        post(rafael, "mine");
        assertThat(ids(page(rafael, null))).isEmpty();
        assertThat(page(rafael, null).get("nextCursor").isNull()).isTrue();
    }

    @Test
    void scrollingShowsEveryPostOnceThenEnds() throws Exception {
        Set<String> posted = new HashSet<>();
        for (int i = 0; i < 23; i++) {
            UUID author = i % 2 == 0 ? linh : data.user("author" + i, "en-US");
            posted.add(post(author, "post " + i).toString());
        }

        JsonNode first = page(rafael, null);
        assertThat(ids(first)).hasSize(10);
        List<String> all = scrollAll(rafael);

        assertThat(all).doesNotHaveDuplicates().containsExactlyInAnyOrderElementsOf(posted);
    }

    @Test
    void blockedAndPrivateAuthorsNeverAppear() throws Exception {
        UUID hidden = data.user("hidden", "en-US");
        data.setPreference(hidden, "profile_visibility", "private");
        post(hidden, "private");
        UUID blocker = data.user("blocker", "en-US");
        post(blocker, "blocked");
        data.block(blocker, rafael);
        UUID visible = post(linh, "public");

        assertThat(scrollAll(rafael)).containsExactly(visible.toString());

        data.follow(rafael, hidden);
        assertThat(scrollAll(rafael)).hasSize(2);
    }

    @Test
    void aBlockInTheMiddleOfASessionTakesEffectOnTheNextPage() throws Exception {
        UUID sofia = data.user("sofia", "es-ES");
        for (int i = 0; i < 12; i++) post(i % 2 == 0 ? linh : sofia, "post " + i);
        JsonNode first = page(rafael, null);

        data.block(rafael, sofia);
        JsonNode second = page(rafael, first.get("nextCursor").asString());

        second.get("items").forEach(item -> assertThat(item.at("/author/username").asString()).isEqualTo("linh"));
    }

    @Test
    void aCursorIsOnlyGoodForItsOwner() throws Exception {
        for (int i = 0; i < 12; i++) post(linh, "post " + i);
        UUID sofia = data.user("sofia", "es-ES");
        String rafaelsCursor = page(rafael, null).get("nextCursor").asString();

        // Someone else's cursor is not an error and does not reveal their session: it starts a fresh one.
        assertThat(ids(page(sofia, rafaelsCursor))).hasSize(10);
        api.get(rafael, "/api/discover?cursor=not-a-cursor").andExpect(status().isBadRequest());
    }

    @Test
    void notInterestedHidesThePostAndUndoBringsItBack() throws Exception {
        UUID boring = post(linh, "boring");
        UUID other = post(data.user("sofia", "es-ES"), "other");

        api.post(rafael, "/api/discover/events", Map.of("events", List.of(event("hide-1", boring, "hide_post"))))
                .andExpect(status().isNoContent());
        assertThat(scrollAll(rafael)).containsExactly(other.toString());

        api.delete(rafael, "/api/discover/hidden/posts/" + boring).andExpect(status().isNoContent());
        assertThat(scrollAll(rafael)).hasSize(2);
    }

    @Test
    void hidingAnAuthorHidesAllTheirPosts() throws Exception {
        post(linh, "one");
        UUID linhsPost = post(linh, "two");
        UUID other = post(data.user("sofia", "es-ES"), "other");

        api.post(rafael, "/api/discover/events", Map.of("events", List.of(event("hide-a", linhsPost, "hide_author"))))
                .andExpect(status().isNoContent());
        assertThat(scrollAll(rafael)).containsExactly(other.toString());

        api.delete(rafael, "/api/discover/hidden/authors/" + linh).andExpect(status().isNoContent());
        assertThat(scrollAll(rafael)).hasSize(3);
    }

    @Test
    void whatTheViewerLikesComesFirstNextTime() throws Exception {
        UUID sofia = data.user("sofia", "es-ES");
        UUID liked = post(linh, "Tokyo trip #travel");
        post(sofia, "Lunch #food");
        UUID travel = post(sofia, "Lisbon streets #travel");
        post(linh, "Cooking #food");

        // Seen, then liked: the liked post itself goes back (already seen); its topic comes forward.
        api.post(rafael, "/api/discover/events", Map.of("events", List.of(event("seen", liked, "impression")))).andExpect(status().isNoContent());
        api.put(rafael, "/api/posts/" + liked + "/like").andExpect(status().isOk());
        signals.runOnce();

        assertThat(ids(page(rafael, null)).getFirst()).isEqualTo(travel.toString());
    }

    static Map<String, Object> event(String clientId, UUID post, String kind) {
        return Map.of("clientId", clientId, "postId", post.toString(), "kind", kind);
    }
}
