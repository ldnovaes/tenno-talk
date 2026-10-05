package com.tennotalk.discovery;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.tennotalk.support.FakeTranslators.Mode;
import com.tennotalk.support.IntegrationTest;
import com.tennotalk.translation.AnthropicTranslator;
import com.tennotalk.translation.OpenAiTranslator;

/** AI topic labels for captions (PLAN.md §37.5), against the fake providers. */
class TopicClassificationIT extends IntegrationTest {

    @Autowired
    ClassificationWorker worker;

    @Autowired
    TopicIndexer indexer;

    private UUID linh;

    @BeforeEach
    void author() {
        linh = data.user("linh", "vi-VN");
    }

    private UUID post(String caption) throws Exception {
        return UUID.fromString(api.postOk(linh, "/api/posts", Map.of("mediaIds", List.of(data.media(linh, "image")), "caption", caption))
                .get("id").asString());
    }

    private List<String> topics(UUID post, String source) {
        return jdbc.sql("SELECT topic FROM post_topics WHERE post_id = :p AND source = :s ORDER BY weight DESC, topic")
                .param("p", post).param("s", source).query(String.class).list();
    }

    private String status(UUID post) {
        return jdbc.sql("SELECT status FROM classification_jobs WHERE post_id = :p").param("p", post).query(String.class).single();
    }

    @Test
    void labelsTheCaptionWithTaxonomyTopics() throws Exception {
        UUID post = post("Weekend of music and food in Hanoi");

        assertThat(worker.runOnce()).isOne();

        assertThat(topics(post, "ai")).containsExactlyInAnyOrder("music", "food");
        assertThat(status(post)).isEqualTo("done");
        assertThat(ai.classificationCalls(OpenAiTranslator.ID)).isOne();
        assertThat(ai.classificationCalls(AnthropicTranslator.ID)).isZero();
        assertThat(worker.runOnce()).isZero();
    }

    @Test
    void fallsBackToTheSecondProvider() throws Exception {
        ai.mode(OpenAiTranslator.ID, Mode.TRANSIENT);
        UUID post = post("travel diary");

        worker.runOnce();

        assertThat(topics(post, "ai")).containsExactly("travel");
        assertThat(ai.classificationCalls(AnthropicTranslator.ID)).isOne();
    }

    @Test
    void withEveryProviderOutOfQuotaTheJobWaitsWithoutSpendingAttempts() throws Exception {
        ai.mode(OpenAiTranslator.ID, Mode.QUOTA);
        ai.mode(AnthropicTranslator.ID, Mode.CREDITS);
        UUID post = post("#travel with friends");

        worker.runOnce();

        assertThat(status(post)).isEqualTo("pending");
        assertThat(jdbc.sql("SELECT attempts FROM classification_jobs WHERE post_id = :p").param("p", post).query(Integer.class).single())
                .isZero();
        assertThat(topics(post, "hashtag")).contains("travel"); // still rankable by its hashtags
        assertThat(worker.runOnce()).isZero(); // waiting, not hammering the providers
    }

    @Test
    void transientFailuresBackOffAndEventuallyGiveUp() throws Exception {
        ai.mode(OpenAiTranslator.ID, Mode.GARBAGE);
        ai.mode(AnthropicTranslator.ID, Mode.GARBAGE);
        UUID post = post("music");
        for (int attempt = 1; attempt <= ClassificationWorker.MAX_ATTEMPTS; attempt++) {
            jdbc.sql("UPDATE classification_jobs SET run_after = now() WHERE post_id = :p").param("p", post).update();
            worker.runOnce();
        }
        assertThat(status(post)).isEqualTo("failed");
        assertThat(topics(post, "ai")).isEmpty();
    }

    @Test
    void aStaleRunningJobIsReclaimed() throws Exception {
        UUID post = post("food");
        jdbc.sql("UPDATE classification_jobs SET status = 'running', locked_at = now() - interval '1 hour' WHERE post_id = :p")
                .param("p", post).update();

        assertThat(worker.runOnce()).isOne();
        assertThat(status(post)).isEqualTo("done");
    }

    @Test
    void theSweepQueuesPostsWhoseIndexingWasLost() throws Exception {
        UUID post = post("food");
        jdbc.sql("DELETE FROM classification_jobs").update();

        assertThat(indexer.runSweep()).isOne();
        assertThat(status(post)).isEqualTo("pending");
    }

    @Test
    void postsWithoutACaptionAreNotQueued() throws Exception {
        UUID post = UUID.fromString(api.postOk(linh, "/api/posts", Map.of("mediaIds", List.of(data.media(linh, "image")), "caption", ""))
                .get("id").asString());
        assertThat(jdbc.sql("SELECT count(*) FROM classification_jobs WHERE post_id = :p").param("p", post).query(Long.class).single())
                .isZero();
    }
}
