-- Discover ranking (PLAN.md §37.5): interaction signals, learned interests and ranking sessions.

-- Everything a viewer does with a post (or an author), as reported by the client or by the services.
-- Append-only; the signals worker folds unprocessed rows into post_stats and user_affinities.
CREATE TABLE interaction_events (
    id           BIGSERIAL   PRIMARY KEY,
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    post_id      UUID        REFERENCES posts (id) ON DELETE CASCADE,
    author_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind         TEXT        NOT NULL CHECK (kind IN ('impression', 'dwell', 'like', 'unlike', 'comment', 'share', 'profile_open',
                                                      'follow', 'unfollow', 'message_author', 'hide_post', 'hide_author', 'report')),
    value        BIGINT      NOT NULL DEFAULT 0,
    client_id    TEXT,
    occurred_at  TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX interaction_events_client ON interaction_events (user_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX interaction_events_pending ON interaction_events (id) WHERE processed_at IS NULL;
CREATE INDEX interaction_events_user ON interaction_events (user_id, kind, occurred_at DESC);
CREATE INDEX interaction_events_post ON interaction_events (post_id) WHERE post_id IS NOT NULL;
CREATE INDEX interaction_events_age ON interaction_events (occurred_at);

-- Denormalized counters of every post (a post without a row has none yet).
CREATE TABLE post_stats (
    post_id      UUID        PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
    impressions  BIGINT      NOT NULL DEFAULT 0,
    likes        BIGINT      NOT NULL DEFAULT 0,
    comments     BIGINT      NOT NULL DEFAULT 0,
    shares       BIGINT      NOT NULL DEFAULT 0,
    hides        BIGINT      NOT NULL DEFAULT 0,
    dwell_ms_sum BIGINT      NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO post_stats (post_id, likes, comments)
SELECT p.id,
       (SELECT count(*) FROM likes l WHERE l.post_id = p.id),
       (SELECT count(*) FROM comments c WHERE c.post_id = p.id)
FROM posts p;

-- Topics of a post: hashtags ("tag:x" and the taxonomy code they name) and the AI classification.
CREATE TABLE post_topics (
    post_id UUID             NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    source  TEXT             NOT NULL CHECK (source IN ('hashtag', 'ai')),
    topic   TEXT             NOT NULL,
    weight  DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (post_id, source, topic)
);
CREATE INDEX post_topics_topic ON post_topics (topic, post_id);

-- Learned interests. key: a topic, "tag:x", "author:<uuid>" or "country:<ISO>". The score is valid at updated_at
-- and decays with the half-life when read.
CREATE TABLE user_affinities (
    user_id    UUID             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    key        TEXT             NOT NULL,
    score      DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ      NOT NULL,
    PRIMARY KEY (user_id, key)
);

-- "Not interested": never shown in Discover again (until undone).
CREATE TABLE hidden_posts (
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    post_id    UUID        NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, post_id)
);

CREATE TABLE hidden_authors (
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    author_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, author_id),
    CHECK (user_id <> author_id)
);

-- People with similar interests (collaborative filtering), recalculated by a job.
CREATE TABLE user_neighbors (
    user_id     UUID             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    neighbor_id UUID             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    similarity  DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (user_id, neighbor_id)
);

-- A ranked snapshot: pages slice it, so a session never repeats or skips a post.
CREATE TABLE discover_sessions (
    id         UUID        PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    post_ids   UUID[]      NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX discover_sessions_expiry ON discover_sessions (expires_at);

-- Topic classification queue (one row per post; SELECT … FOR UPDATE SKIP LOCKED).
CREATE TABLE classification_jobs (
    post_id    UUID        PRIMARY KEY REFERENCES posts (id) ON DELETE CASCADE,
    status     TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
    attempts   INT         NOT NULL DEFAULT 0,
    run_after  TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at  TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX classification_jobs_ready ON classification_jobs (status, run_after);

INSERT INTO classification_jobs (post_id)
SELECT id FROM posts WHERE caption_text IS NOT NULL AND created_at > now() - interval '14 days';
