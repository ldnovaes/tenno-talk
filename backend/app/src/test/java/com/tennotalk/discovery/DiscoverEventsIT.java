package com.tennotalk.discovery;

import static com.tennotalk.discovery.DiscoverIT.event;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.tennotalk.support.IntegrationTest;

/** Interaction events and how they become counters and interests (PLAN.md §37.5). */
class DiscoverEventsIT extends IntegrationTest {

    @Autowired
    SignalsWorker signals;

    @Autowired
    NeighborsJob neighbors;

    @Autowired
    DiscoverRetention retention;

    private UUID rafael;
    private UUID linh;
    private UUID post;

    @BeforeEach
    void people() throws Exception {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
        post = UUID.fromString(api.postOk(linh, "/api/posts",
                Map.of("mediaIds", List.of(data.media(linh, "image")), "caption", "Phở #food #Vietnam")).get("id").asString());
    }

    private long events(UUID user, String kind) {
        return jdbc.sql("SELECT count(*) FROM interaction_events WHERE user_id = :u AND kind = :k").param("u", user).param("k", kind)
                .query(Long.class).single();
    }

    private long stat(String column) {
        return jdbc.sql("SELECT coalesce((SELECT " + column + " FROM post_stats WHERE post_id = :p), 0)").param("p", post)
                .query(Long.class).single();
    }

    private Double affinity(UUID user, String key) {
        return jdbc.sql("SELECT score FROM user_affinities WHERE user_id = :u AND key = :k").param("u", user).param("k", key)
                .query(Double.class).optional().orElse(null);
    }

    private void send(UUID user, Object... events) throws Exception {
        api.post(user, "/api/discover/events", Map.of("events", List.of(events))).andExpect(status().isNoContent());
    }

    @Test
    void creatingAPostIndexesItsHashtagsAndQueuesTheClassifier() {
        List<String> topics = jdbc.sql("SELECT topic FROM post_topics WHERE post_id = :p AND source = 'hashtag' ORDER BY topic")
                .param("p", post).query(String.class).list();
        assertThat(topics).containsExactly("food", "tag:food", "tag:vietnam");
        assertThat(jdbc.sql("SELECT status FROM classification_jobs WHERE post_id = :p").param("p", post).query(String.class).single())
                .isEqualTo("pending");
    }

    @Test
    void clientEventsAreIdempotentAndValidated() throws Exception {
        Map<String, Object> dwell = new HashMap<>(event("d1", post, "dwell"));
        dwell.put("value", 9_999_999);
        send(rafael, event("i1", post, "impression"), event("i1", post, "impression"), dwell,
                event("x1", post, "like"), event("x2", post, "superlike"), Map.of("clientId", "x3", "postId", "nope", "kind", "share"));
        send(rafael, event("i1", post, "impression"));

        assertThat(events(rafael, "impression")).isOne();
        assertThat(events(rafael, "dwell")).isOne();
        assertThat(events(rafael, "like")).isZero(); // likes come from the like endpoint, never from clients
        assertThat(jdbc.sql("SELECT value FROM interaction_events WHERE kind = 'dwell'").query(Long.class).single()).isEqualTo(600_000);
    }

    @Test
    void eventsForPostsTheViewerCannotSeeAreIgnored() throws Exception {
        data.block(linh, rafael);
        send(rafael, event("i1", post, "impression"));
        assertThat(events(rafael, "impression")).isZero();
    }

    @Test
    void clientTimestampsAreClampedToTheLastDay() throws Exception {
        Map<String, Object> future = new HashMap<>(event("f", post, "impression"));
        future.put("at", Instant.now().plusSeconds(3_600).toString());
        send(rafael, future);
        Instant stored = jdbc.sql("SELECT occurred_at FROM interaction_events WHERE client_id = 'f'").query(java.sql.Timestamp.class)
                .single().toInstant();
        assertThat(stored).isBefore(Instant.now().plusSeconds(5));
    }

    @Test
    void theServicesRecordLikesCommentsFollowsAndReports() throws Exception {
        api.put(rafael, "/api/posts/" + post + "/like").andExpect(status().isOk());
        api.put(rafael, "/api/posts/" + post + "/like").andExpect(status().isOk()); // already liked: no second event
        api.delete(rafael, "/api/posts/" + post + "/like").andExpect(status().isOk());
        api.postOk(rafael, "/api/posts/" + post + "/comments", Map.of("text", "Ngon!"));
        api.put(rafael, "/api/profiles/" + linh + "/follow").andExpect(status().isOk());
        api.postOk(rafael, "/api/reports", Map.of("targetKind", "post", "targetId", post, "reason", "spam"));
        api.put(linh, "/api/posts/" + post + "/like").andExpect(status().isOk()); // own post: not a signal

        assertThat(events(rafael, "like")).isOne();
        assertThat(events(rafael, "unlike")).isOne();
        assertThat(events(rafael, "comment")).isOne();
        assertThat(events(rafael, "follow")).isOne();
        assertThat(events(rafael, "report")).isOne();
        assertThat(events(linh, "like")).isZero();
    }

    @Test
    void theWorkerFoldsEventsIntoCountersAndInterestsExactlyOnce() throws Exception {
        send(rafael, event("i1", post, "impression"), Map.of("clientId", "d1", "postId", post.toString(), "kind", "dwell", "value", 15_000));
        api.put(rafael, "/api/posts/" + post + "/like").andExpect(status().isOk());

        assertThat(signals.runOnce()).isEqualTo(3);
        assertThat(signals.runOnce()).isZero();

        assertThat(stat("impressions")).isOne();
        assertThat(stat("dwell_ms_sum")).isEqualTo(15_000);
        assertThat(stat("likes")).isEqualTo(1);
        assertThat(affinity(rafael, "author:" + linh)).isCloseTo(1.8, org.assertj.core.data.Offset.offset(0.01));
        assertThat(affinity(rafael, "food")).isPositive();
        assertThat(affinity(rafael, "tag:vietnam")).isPositive();
        assertThat(affinity(rafael, "country:BR")).isPositive(); // linh's country in the test data
    }

    @Test
    void hidingTeachesADislike() throws Exception {
        send(rafael, event("h1", post, "hide_post"));
        signals.runOnce();
        assertThat(affinity(rafael, "food")).isNegative();
        assertThat(stat("hides")).isOne();
    }

    @Test
    void aPoisonEventIsSkippedWithoutBlockingTheQueue() throws Exception {
        send(rafael, event("i1", post, "impression"));
        // A row the worker cannot apply: its post vanished between insert and processing.
        jdbc.sql("ALTER TABLE interaction_events DROP CONSTRAINT interaction_events_post_id_fkey").update();
        try {
            jdbc.sql("""
                    INSERT INTO interaction_events (user_id, post_id, author_id, kind, occurred_at)
                    VALUES (:u, gen_random_uuid(), :a, 'impression', now())
                    """).param("u", rafael).param("a", linh).update();
            assertThat(signals.runOnce()).isEqualTo(2);
            assertThat(jdbc.sql("SELECT count(*) FROM interaction_events WHERE processed_at IS NULL").query(Long.class).single()).isZero();
            assertThat(stat("impressions")).isOne();
        } finally {
            jdbc.sql("DELETE FROM interaction_events WHERE post_id NOT IN (SELECT id FROM posts)").update();
            jdbc.sql("ALTER TABLE interaction_events ADD CONSTRAINT interaction_events_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE").update();
        }
    }

    @Test
    void peopleWithTheSameTastesBecomeNeighbors() throws Exception {
        UUID sofia = data.user("sofia", "es-ES");
        api.put(rafael, "/api/posts/" + post + "/like").andExpect(status().isOk());
        api.put(sofia, "/api/posts/" + post + "/like").andExpect(status().isOk());
        signals.runOnce();

        assertThat(neighbors.runOnce()).isEqualTo(2);
        assertThat(jdbc.sql("SELECT neighbor_id FROM user_neighbors WHERE user_id = :u").param("u", rafael).query(UUID.class).list())
                .containsExactly(sofia);
    }

    @Test
    void retentionDropsOldEventsExpiredSessionsAndFadedInterests() throws Exception {
        send(rafael, event("i1", post, "impression"));
        signals.runOnce();
        api.getOk(rafael, "/api/discover");
        jdbc.sql("UPDATE interaction_events SET occurred_at = now() - interval '91 days'").update();
        jdbc.sql("UPDATE discover_sessions SET expires_at = now() - interval '1 minute'").update();
        jdbc.sql("INSERT INTO user_affinities (user_id, key, score, updated_at) VALUES (:u, 'faded', 1, now() - interval '400 days')")
                .param("u", rafael).update();

        retention.runOnce();

        assertThat(jdbc.sql("SELECT count(*) FROM interaction_events").query(Long.class).single()).isZero();
        assertThat(jdbc.sql("SELECT count(*) FROM discover_sessions").query(Long.class).single()).isZero();
        assertThat(affinity(rafael, "faded")).isNull();
    }

    @Test
    void theDataExportIncludesWhatDiscoverLearned() throws Exception {
        send(rafael, event("h1", post, "hide_post"));
        signals.runOnce();
        String export = api.get(rafael, "/api/me/export").andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(export).contains("discoverInteractions", "hide_post", "discoverInterests", "discoverHiddenPosts", post.toString());
    }
}
