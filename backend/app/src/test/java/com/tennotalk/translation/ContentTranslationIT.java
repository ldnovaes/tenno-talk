package com.tennotalk.translation;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;

import com.tennotalk.support.FakeTranslators.Mode;
import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Captions, comments and story texts translated on demand (PLAN.md §28.2, §28.3): when the AI is down the request
 * answers "pending", the job waits, and the worker finishes it once a provider is back, for each kind of content.
 */
class ContentTranslationIT extends IntegrationTest {

    @Autowired
    TranslationWorker worker;

    @Autowired
    ProviderStatusService providers;

    @Autowired
    ProviderHealthService health;

    private UUID author;
    private UUID reader;

    @BeforeEach
    void people() {
        author = data.user("rafael", "pt-BR");
        reader = data.user("emma", "en-US");
    }

    /** One piece of content of each kind, written in Portuguese; returns its id. */
    private String content(String kind) throws Exception {
        return switch (kind) {
            case "post" -> api.postOk(author, "/api/posts", Map.of("mediaIds", List.of(data.media(author, "image")), "caption", "Praia linda"))
                    .get("id").asString();
            case "comment" -> {
                String post = api.postOk(author, "/api/posts", Map.of("mediaIds", List.of(data.media(author, "image")))).get("id").asString();
                yield api.postOk(author, "/api/posts/" + post + "/comments", Map.of("text", "Que dia")).get("id").asString();
            }
            case "story" -> api.postOk(author, "/api/stories", Map.of("mediaId", data.media(author, "image"), "text", "Bom dia"))
                    .get("id").asString();
            default -> throw new IllegalArgumentException(kind);
        };
    }

    private JsonNode translate(String kind, String id, String language) throws Exception {
        return api.postOk(reader, "/api/translations/" + kind + "/" + id + "?lang=" + language, null);
    }

    private String job(String kind) {
        return jdbc.sql("SELECT status FROM translation_jobs WHERE kind = :k").param("k", kind).query(String.class).single();
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"post", "comment", "story"})
    void waitsWhileBothProvidersAreDownAndFinishesWhenOneIsBack(String kind) throws Exception {
        String id = content(kind);
        ai.mode("openai", Mode.AUTH);
        ai.mode("anthropic", Mode.AUTH);

        assertThat(translate(kind, id, "en-US").get("status").asString()).isEqualTo("pending");
        worker.runOnce();
        assertThat(job(kind)).isEqualTo("waiting_provider");

        // The admin fixes the Anthropic key and checks it: the waiting job returns to the queue.
        ai.mode("anthropic", Mode.OK);
        assertThat(health.checkNow("anthropic")).isTrue();
        assertThat(job(kind)).isEqualTo("pending");
        worker.runOnce();

        assertThat(job(kind)).isEqualTo("done");
        long calls = ai.translationCalls("openai") + ai.translationCalls("anthropic");
        JsonNode done = translate(kind, id, "en-US");
        assertThat(done.get("status").asString()).isEqualTo("translated");
        assertThat(done.get("text").asString()).startsWith("[English");
        assertThat(ai.translationCalls("openai") + ai.translationCalls("anthropic")).as("served from the cache afterwards").isEqualTo(calls);
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"post", "comment", "story"})
    void aRepeatedlyFailingTranslationEndsAsFailedAndCanBeAskedAgain(String kind) throws Exception {
        String id = content(kind);
        ai.mode("openai", Mode.GARBAGE);
        ai.mode("anthropic", Mode.GARBAGE);
        assertThat(translate(kind, id, "en-US").get("status").asString()).isEqualTo("pending");
        for (int attempt = 0; attempt < 5; attempt++) {
            jdbc.sql("UPDATE translation_jobs SET run_after = now() - interval '1 second' WHERE status = 'pending'").update();
            worker.runOnce();
        }
        assertThat(job(kind)).isEqualTo("failed");
        String stored = jdbc.sql("SELECT status FROM content_translations WHERE content_kind = :k").param("k", kind).query(String.class).single();
        assertThat(stored).isEqualTo("failed");

        ai.mode("openai", Mode.OK);
        assertThat(translate(kind, id, "en-US").get("status").asString()).as("asking again tries again").isEqualTo("translated");
    }

    @Test
    void sameLanguageNeedsNoTranslationAndCallsNoProvider() throws Exception {
        String id = content("post");
        assertThat(translate("post", id, "pt-BR").get("status").asString()).isEqualTo("not_needed");
        assertThat(ai.translationCalls("openai") + ai.translationCalls("anthropic")).isZero();
    }

    @Test
    void contentDeletedBeforeTheWorkerRunsEndsTheJobQuietly() throws Exception {
        String id = content("comment");
        ai.mode("openai", Mode.AUTH);
        ai.mode("anthropic", Mode.AUTH);
        translate("comment", id, "en-US");
        jdbc.sql("DELETE FROM comments WHERE id = :id").param("id", UUID.fromString(id)).update();
        ai.mode("openai", Mode.OK);
        assertThat(health.checkNow("openai")).isTrue();

        worker.runOnce();

        assertThat(jdbc.sql("SELECT count(*) FROM translation_jobs WHERE status IN ('pending', 'running')").query(Long.class).single()).isZero();
    }

    @Test
    void whenBothProvidersCoolDownTheQueueResumesByItselfOnceTheCooldownEnds() throws Exception {
        UUID linh = data.user("linh", "vi-VN");
        UUID conversation = steps.direct(author, linh);
        ai.mode("openai", Mode.QUOTA);
        ai.mode("anthropic", Mode.QUOTA);
        steps.send(author, conversation, "Oi");
        worker.runOnce();
        assertThat(job("message")).isEqualTo("waiting_provider");

        ai.mode("openai", Mode.OK);
        jdbc.sql("UPDATE ai_provider_status SET until = now() - interval '1 second'").update();
        providers.recoverExpired(); // the scheduled check: ProviderRecovered → the waiting jobs return to the queue

        assertThat(job("message")).isEqualTo("pending");
        worker.runOnce();
        assertThat(steps.lastMessage(linh, conversation).at("/translation/status").asString()).isEqualTo("translated");
    }
}
