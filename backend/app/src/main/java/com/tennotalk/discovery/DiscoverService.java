package com.tennotalk.discovery;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.tennotalk.common.Ids;
import com.tennotalk.common.PageDto;
import com.tennotalk.discovery.DiscoverSessions.Snapshot;
import com.tennotalk.feed.FeedDtos.PostDto;
import com.tennotalk.feed.FeedService;
import com.tennotalk.feed.Visibility;
import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.Diagnostics;
import com.tennotalk.recommender.RankRequest;
import com.tennotalk.recommender.Ranking;
import com.tennotalk.recommender.Recommender;
import com.tennotalk.recommender.Viewer;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

/**
 * Discover pages (PLAN.md §37.6). A session is ranked once and sliced; each page is re-checked for visibility.
 * Fallbacks, from best to worst: the recommender's own safe ranking → newest-first of the candidates (ranking
 * late or failing) → newest visible posts straight from the database (candidate sources down). Discover never
 * fails because of the algorithm.
 */
@Service
public class DiscoverService {

    private static final Logger log = LoggerFactory.getLogger(DiscoverService.class);

    private final ViewerLoader viewers;
    private final CandidateRetriever retriever;
    private final DiscoverSessions sessions;
    private final Recommender recommender;
    private final RankingExecutor executor;
    private final FeedService feed;
    private final DiscoverReads reads;
    private final DiscoverProperties properties;
    private final MeterRegistry meters;
    private final Clock clock;

    DiscoverService(ViewerLoader viewers, CandidateRetriever retriever, DiscoverSessions sessions, Recommender recommender,
            RankingExecutor executor, FeedService feed, DiscoverReads reads, DiscoverProperties properties, MeterRegistry meters,
            Clock clock) {
        this.viewers = viewers;
        this.retriever = retriever;
        this.sessions = sessions;
        this.recommender = recommender;
        this.executor = executor;
        this.feed = feed;
        this.reads = reads;
        this.properties = properties;
        this.meters = meters;
        this.clock = clock;
    }

    public PageDto<PostDto> page(UUID viewer, String cursor) {
        Instant now = clock.instant();
        DiscoverCursor position = DiscoverCursor.decodeOrNull(cursor);
        Snapshot snapshot;
        int offset = 0;
        Optional<Snapshot> open = position == null ? Optional.empty() : sessions.find(viewer, position.session(), now);
        if (open.isEmpty()) {
            snapshot = start(viewer, Set.of(), now);
        } else if (position.offset() >= open.get().size()) {
            // Exhausted: rank a new session without what this one already showed.
            snapshot = start(viewer, Set.copyOf(open.get().postIds()), now);
        } else {
            snapshot = open.get();
            offset = position.offset();
        }

        List<PostDto> items = new ArrayList<>();
        int next = offset;
        while (items.size() < properties.pageSize() && next < snapshot.size()) {
            int end = Math.min(snapshot.size(), next + properties.pageSize() - items.size());
            items.addAll(feed.visibleInOrder(viewer, snapshot.postIds().subList(next, end)));
            next = end;
        }
        String nextCursor = snapshot.size() == 0 ? null : new DiscoverCursor(snapshot.id(), next).encode();
        return new PageDto<>(items, nextCursor);
    }

    private Snapshot start(UUID viewer, Set<UUID> exclude, Instant now) {
        UUID id = Ids.newId();
        return sessions.create(viewer, id, rank(viewer, exclude, now, id), now);
    }

    private List<UUID> rank(UUID viewerId, Set<UUID> exclude, Instant now, UUID session) {
        Timer.Sample sample = Timer.start(meters);
        try {
            Viewer viewer = viewers.load(viewerId, now);
            CandidateRetriever.Result candidates = retriever.retrieve(viewer, now, exclude);
            if (candidates.sourcesAnswered() == 0) return newestVisible(viewerId, exclude, now, "sources");
            RankRequest request = new RankRequest(viewer, candidates.candidates(), properties.sessionSize(),
                    session.getMostSignificantBits() ^ session.getLeastSignificantBits(), now);
            Optional<Ranking> ranking = executor.run(() -> recommender.rank(request), properties.rankTimeout());
            if (ranking.isEmpty()) {
                fallback("timeout");
                return newestFirst(candidates.candidates());
            }
            record(ranking.get().diagnostics());
            return ranking.get().postIds();
        } catch (RuntimeException failure) {
            log.warn("Discover ranking failed, newest-first instead: {}", failure.toString());
            return newestVisible(viewerId, exclude, now, "error");
        } finally {
            sample.stop(meters.timer("discover.rank.latency"));
        }
    }

    private List<UUID> newestFirst(List<Candidate> candidates) {
        return candidates.stream().sorted(Comparator.comparing(Candidate::createdAt).reversed().thenComparing(Candidate::postId))
                .map(Candidate::postId).limit(properties.sessionSize()).toList();
    }

    /** Last resort: the newest posts the viewer can see, straight from the database. */
    private List<UUID> newestVisible(UUID viewer, Set<UUID> exclude, Instant now, String reason) {
        fallback(reason);
        return reads.jdbc.sql("""
                SELECT p.id FROM posts p
                WHERE p.created_at > :since AND p.author_id <> :viewer
                  AND NOT EXISTS (SELECT 1 FROM hidden_posts h WHERE h.user_id = :viewer AND h.post_id = p.id)
                  AND NOT EXISTS (SELECT 1 FROM hidden_authors h WHERE h.user_id = :viewer AND h.author_id = p.author_id)
                  AND %s
                ORDER BY p.created_at DESC, p.id DESC LIMIT :limit
                """.formatted(Visibility.authorVisible("p.author_id")))
                .param("viewer", viewer).param("since", Timestamp.from(now.minus(properties.window())))
                .param("limit", properties.sessionSize() + exclude.size())
                .query(UUID.class).list().stream().filter(id -> !exclude.contains(id)).limit(properties.sessionSize()).toList();
    }

    private void record(Diagnostics diagnostics) {
        if (diagnostics.usedFallback()) fallback("recommender:" + diagnostics.fallback());
        for (Map.Entry<String, Integer> failure : diagnostics.failures().entrySet()) {
            meters.counter("discover.decorator.failures", "signal", failure.getKey()).increment(failure.getValue());
        }
        for (String signal : diagnostics.disabled()) meters.counter("discover.decorator.disabled", "signal", signal).increment();
        meters.counter("discover.exposure.floor").increment(diagnostics.exposureSlots());
        if (!diagnostics.failures().isEmpty() || !diagnostics.slow().isEmpty()) {
            log.warn("Discover signals misbehaved: failures={} slow={} disabled={}", diagnostics.failures(), diagnostics.slow(),
                    diagnostics.disabled());
        }
    }

    private void fallback(String reason) {
        meters.counter("discover.fallback", "reason", reason).increment();
    }
}
