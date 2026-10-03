-- Domain schema (PLAN.md §27). Authorization lives in the services (no RLS):
-- every query that reads a conversation filters by membership.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE users (
    id                      UUID PRIMARY KEY,
    role                    TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    email                   CITEXT UNIQUE,
    email_verified_at       TIMESTAMPTZ,
    password_hash           TEXT,
    username                CITEXT UNIQUE,
    display_name            TEXT        NOT NULL DEFAULT '',
    avatar_url              TEXT,
    bio                     TEXT,
    country                 TEXT        NOT NULL DEFAULT '',
    native_language         TEXT        NOT NULL,
    learning_languages      TEXT[]      NOT NULL DEFAULT '{}',
    onboarding_completed_at TIMESTAMPTZ,
    last_seen_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE oauth_accounts (
    provider         TEXT NOT NULL CHECK (provider IN ('google', 'facebook')),
    provider_user_id TEXT NOT NULL,
    user_id          UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, provider_user_id)
);
CREATE INDEX oauth_accounts_user ON oauth_accounts (user_id);

CREATE TABLE terms_acceptances (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    terms_version TEXT        NOT NULL,
    accepted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip            TEXT,
    user_agent    TEXT
);
CREATE INDEX terms_acceptances_user ON terms_acceptances (user_id, accepted_at DESC);

CREATE TABLE user_preferences (
    user_id                UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    interface_language     TEXT    NOT NULL DEFAULT 'en-US',
    receiving_language     TEXT    NOT NULL,
    display_mode           TEXT    NOT NULL DEFAULT 'translation' CHECK (display_mode IN ('translation', 'both', 'original')),
    auto_translate_posts   BOOLEAN NOT NULL DEFAULT TRUE,
    auto_translate_stories BOOLEAN NOT NULL DEFAULT TRUE,
    learning_mode          BOOLEAN NOT NULL DEFAULT FALSE,
    profile_visibility     TEXT    NOT NULL DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private')),
    who_can_message        TEXT    NOT NULL DEFAULT 'everyone' CHECK (who_can_message IN ('everyone', 'followers', 'nobody')),
    who_can_comment        TEXT    NOT NULL DEFAULT 'everyone' CHECK (who_can_comment IN ('everyone', 'followers', 'nobody')),
    notify_messages        BOOLEAN NOT NULL DEFAULT TRUE,
    notify_comments        BOOLEAN NOT NULL DEFAULT TRUE,
    notify_likes           BOOLEAN NOT NULL DEFAULT TRUE,
    notify_followers       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE follows (
    follower_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    followee_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee ON follows (followee_id);

CREATE TABLE blocks (
    blocker_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

CREATE TABLE conversations (
    id         UUID PRIMARY KEY,
    kind       TEXT        NOT NULL CHECK (kind IN ('direct', 'group')),
    title      TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES users (id) ON DELETE SET NULL,
    -- Sorted pair of member ids: at most one direct conversation per pair.
    direct_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Product rule (PLAN.md §34): each person creates at most one group.
CREATE UNIQUE INDEX conversations_one_group_per_creator ON conversations (created_by) WHERE kind = 'group';

CREATE TABLE conversation_members (
    conversation_id           UUID        NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    user_id                   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role                      TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    last_read_message_id      UUID,
    last_delivered_message_id UUID,
    muted_until               TIMESTAMPTZ,
    joined_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX conversation_members_user ON conversation_members (user_id);

CREATE TABLE media (
    id            UUID PRIMARY KEY,
    owner_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind          TEXT        NOT NULL CHECK (kind IN ('image', 'video', 'audio', 'file')),
    mime_type     TEXT        NOT NULL,
    size_bytes    BIGINT      NOT NULL,
    width         INT,
    height        INT,
    duration_ms   INT,
    storage_path  TEXT        NOT NULL,
    original_name TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id                UUID PRIMARY KEY,
    conversation_id   UUID        NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender_id         UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Idempotency key from the client (PLAN.md §13).
    client_id         TEXT        NOT NULL,
    type              TEXT        NOT NULL CHECK (type IN ('text', 'image', 'video', 'file', 'story_reply')),
    -- The original is immutable: no edits for now (PLAN.md §34).
    original_text     TEXT,
    original_language TEXT        NOT NULL,
    reply_to_id       UUID REFERENCES messages (id) ON DELETE SET NULL,
    story_id          UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (sender_id, client_id)
);
CREATE INDEX messages_conversation_created ON messages (conversation_id, created_at DESC, id DESC);

CREATE TABLE message_media (
    message_id UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    media_id   UUID NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    position   INT  NOT NULL,
    PRIMARY KEY (message_id, position)
);

CREATE TABLE message_reactions (
    message_id UUID        NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emoji      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE message_translations (
    message_id      UUID        NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
    target_language TEXT        NOT NULL,
    text            TEXT,
    literal_text    TEXT,
    status          TEXT        NOT NULL CHECK (status IN ('pending', 'translating', 'translated', 'failed')),
    version         INT         NOT NULL DEFAULT 0,
    provider        TEXT,
    error           TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, target_language)
);

-- Translation queue (PLAN.md §28.2): claimed with FOR UPDATE SKIP LOCKED.
CREATE TABLE translation_jobs (
    id              BIGSERIAL PRIMARY KEY,
    kind            TEXT        NOT NULL CHECK (kind IN ('message', 'post', 'comment', 'story')),
    ref_id          UUID        NOT NULL,
    target_language TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'waiting_provider', 'done', 'failed')),
    run_after       TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts        INT         NOT NULL DEFAULT 0,
    locked_at       TIMESTAMPTZ,
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (kind, ref_id, target_language)
);
CREATE INDEX translation_jobs_ready ON translation_jobs (status, run_after, id);

-- AI providers state (PLAN.md §28.3).
CREATE TABLE ai_provider_status (
    provider   TEXT PRIMARY KEY CHECK (provider IN ('codex', 'claude')),
    state      TEXT        NOT NULL DEFAULT 'ok' CHECK (state IN ('ok', 'needs_reauth', 'reauth_pending', 'cooling_down')),
    until      TIMESTAMPTZ,
    last_error TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO ai_provider_status (provider) VALUES ('codex'), ('claude');

CREATE TABLE posts (
    id               UUID PRIMARY KEY,
    author_id        UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    caption_text     TEXT,
    caption_language TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX posts_created ON posts (created_at DESC, id DESC);
CREATE INDEX posts_author ON posts (author_id, created_at DESC);

CREATE TABLE post_media (
    post_id  UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    position INT  NOT NULL,
    PRIMARY KEY (post_id, position)
);

CREATE TABLE likes (
    post_id    UUID        NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE comments (
    id            UUID PRIMARY KEY,
    post_id       UUID        NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
    author_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body_text     TEXT        NOT NULL,
    body_language TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX comments_post ON comments (post_id, created_at);

CREATE TABLE stories (
    id               UUID PRIMARY KEY,
    author_id        UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    media_id         UUID        NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    overlay_text     TEXT,
    overlay_language TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at       TIMESTAMPTZ NOT NULL
);
CREATE INDEX stories_active ON stories (expires_at);

CREATE TABLE story_views (
    story_id  UUID        NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (story_id, user_id)
);

CREATE TABLE story_reactions (
    id         BIGSERIAL PRIMARY KEY,
    story_id   UUID        NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    emoji      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Translations of posts, comments and stories (on demand, cached).
CREATE TABLE content_translations (
    content_kind    TEXT        NOT NULL CHECK (content_kind IN ('post', 'comment', 'story')),
    content_id      UUID        NOT NULL,
    target_language TEXT        NOT NULL,
    text            TEXT,
    status          TEXT        NOT NULL CHECK (status IN ('pending', 'translating', 'translated', 'failed')),
    version         INT         NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (content_kind, content_id, target_language)
);

CREATE TABLE notifications (
    id              UUID PRIMARY KEY,
    recipient_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    actor_id        UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type            TEXT        NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'story_reaction', 'new_message')),
    post_id         UUID,
    comment_id      UUID,
    story_id        UUID,
    emoji           TEXT,
    conversation_id UUID,
    message_id      UUID,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX notifications_recipient ON notifications (recipient_id, created_at DESC);

CREATE TABLE reports (
    id          UUID PRIMARY KEY,
    reporter_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_kind TEXT        NOT NULL CHECK (target_kind IN ('user', 'message', 'post', 'comment', 'story')),
    target_id   UUID        NOT NULL,
    reason      TEXT        NOT NULL,
    status      TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
