-- Production hardening (PLAN.md §38).

-- GET /api/media/{id} (MediaRepository.canView) and the cleanup of unused files look media up from these tables.
CREATE INDEX message_media_media ON message_media (media_id);
CREATE INDEX post_media_media ON post_media (media_id);
CREATE INDEX stories_media ON stories (media_id);
CREATE INDEX users_avatar_url ON users (avatar_url) WHERE avatar_url IS NOT NULL;

-- Upload quotas: bytes per owner, in total and in the last day.
CREATE INDEX media_owner ON media (owner_id, created_at);

-- Retention of read notifications.
CREATE INDEX notifications_read ON notifications (read_at) WHERE read_at IS NOT NULL;

-- People search matches anywhere in the name ('%q%'): trigram indexes instead of reading every user.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX users_display_name_trgm ON users USING gin (display_name gin_trgm_ops);
CREATE INDEX users_username_trgm ON users USING gin ((username::text) gin_trgm_ops);
