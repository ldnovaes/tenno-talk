-- Private profiles grant access only after the owner approves a follow request.
CREATE TABLE follow_requests (
    follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);
CREATE INDEX follow_requests_followee ON follow_requests (followee_id, created_at DESC);
