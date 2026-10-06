package com.tennotalk.ops;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.tennotalk.support.IntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;

/** Retention on the shared VPS (PLAN.md §38): finished jobs and old read notifications go away, nothing else. */
class HousekeepingIT extends IntegrationTest {

    @Autowired
    Housekeeping housekeeping;

    private long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }

    @Test
    void finishedJobsOlderThanAWeekAreRemovedAndPendingOnesStay() {
        String insert = "INSERT INTO translation_jobs (kind, ref_id, target_language, status, created_at) VALUES ('post', :r, 'en-US', :s, now() - interval '8 days')";
        for (String status : List.of("done", "failed", "pending", "waiting_provider")) {
            jdbc.sql(insert).param("r", UUID.randomUUID()).param("s", status).update();
        }
        jdbc.sql("INSERT INTO translation_jobs (kind, ref_id, target_language, status) VALUES ('post', :r, 'en-US', 'done')")
                .param("r", UUID.randomUUID()).update();

        housekeeping.runOnce();

        assertThat(jdbc.sql("SELECT status FROM translation_jobs ORDER BY status").query(String.class).list())
                .containsExactly("done", "pending", "waiting_provider");
    }

    @Test
    void finishedClassificationJobsOlderThanAWeekAreRemoved() throws Exception {
        UUID author = data.user("rafael", "pt-BR");
        for (int i = 0; i < 2; i++) {
            api.postOk(author, "/api/posts", Map.of("mediaIds", List.of(data.media(author, "image")), "caption", "Praia #" + i));
        }
        jdbc.sql("UPDATE classification_jobs SET status = 'done', created_at = now() - interval '8 days'").update();
        jdbc.sql("UPDATE classification_jobs SET status = 'pending' WHERE post_id = (SELECT min(post_id::text)::uuid FROM classification_jobs)").update();

        housekeeping.runOnce();

        assertThat(jdbc.sql("SELECT status FROM classification_jobs").query(String.class).list()).containsExactly("pending");
    }

    @Test
    void readNotificationsOlderThanNinetyDaysAreRemovedUnreadOnesStay() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        UUID linh = data.user("linh", "vi-VN");
        UUID ana = data.user("ana", "es-ES");
        api.put(linh, "/api/profiles/" + rafael + "/follow");
        api.put(ana, "/api/profiles/" + rafael + "/follow");
        api.put(rafael, "/api/profiles/" + linh + "/follow");
        jdbc.sql("UPDATE notifications SET created_at = now() - interval '200 days'").update();
        jdbc.sql("UPDATE notifications SET read_at = now() - interval '100 days' WHERE recipient_id = :r").param("r", rafael).update();
        jdbc.sql("UPDATE notifications SET read_at = now() - interval '10 days' WHERE actor_id = :a").param("a", ana).update();

        housekeeping.runOnce();

        assertThat(count("SELECT count(*) FROM notifications")).as("ana's (read recently) and linh's (unread)").isEqualTo(2);
        assertThat(count("SELECT count(*) FROM notifications WHERE recipient_id = '" + linh + "'")).isOne();
    }

    @Test
    void theScheduledRunWorksOnAnEmptyDatabase() {
        housekeeping.run();
        assertThat(count("SELECT count(*) FROM media")).isZero();
    }
}
