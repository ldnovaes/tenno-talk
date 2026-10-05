package com.tennotalk.discovery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.tennotalk.support.IntegrationTest;

import io.micrometer.core.instrument.MeterRegistry;
import tools.jackson.databind.JsonNode;

/** Discover keeps answering when the ranking machinery fails (PLAN.md §37.6). */
class DiscoverFallbackIT extends IntegrationTest {

    @MockitoSpyBean
    CandidateRetriever retriever;

    @MockitoSpyBean
    RankingExecutor executor;

    @Autowired
    MeterRegistry meters;

    private UUID rafael;
    private final List<String> visible = new ArrayList<>();

    @BeforeEach
    void posts() throws Exception {
        rafael = data.user("rafael", "pt-BR");
        UUID linh = data.user("linh", "vi-VN");
        UUID blocker = data.user("blocker", "en-US");
        for (int i = 0; i < 3; i++) visible.add(post(linh, "post " + i));
        post(blocker, "never");
        data.block(blocker, rafael);
    }

    @AfterEach
    void restore() {
        reset(retriever, executor);
    }

    private String post(UUID author, String caption) throws Exception {
        return api.postOk(author, "/api/posts", Map.of("mediaIds", List.of(data.media(author, "image")), "caption", caption))
                .get("id").asString();
    }

    private double fallbacks(String reason) {
        var counter = meters.find("discover.fallback").tag("reason", reason).counter();
        return counter == null ? 0 : counter.count();
    }

    private List<String> ids() throws Exception {
        JsonNode page = api.getOk(rafael, "/api/discover");
        List<String> ids = new ArrayList<>();
        page.get("items").forEach(item -> ids.add(item.get("id").asString()));
        return ids;
    }

    @Test
    void candidateSourcesDownMeansNewestVisiblePosts() throws Exception {
        doThrow(new IllegalStateException("database hiccup")).when(retriever).retrieve(any(), any(), any());
        double before = fallbacks("error");
        assertThat(ids()).containsExactlyElementsOf(visible.reversed());
        assertThat(fallbacks("error")).isEqualTo(before + 1);
    }

    @Test
    void aRankingThatIsLateOrRejectedMeansNewestFirstOfTheCandidates() throws Exception {
        doReturn(Optional.empty()).when(executor).run(any(), any());
        double before = fallbacks("timeout");
        assertThat(ids()).containsExactlyElementsOf(visible.reversed());
        assertThat(fallbacks("timeout")).isEqualTo(before + 1);
    }

    @Test
    void everySourceFailingIsAnOutageNotAnEmptyFeed() throws Exception {
        doReturn(new CandidateRetriever.Result(List.of(), 0)).when(retriever).retrieve(any(), any(), any());
        double before = fallbacks("sources");
        assertThat(ids()).containsExactlyElementsOf(visible.reversed());
        assertThat(fallbacks("sources")).isEqualTo(before + 1);
    }
}
