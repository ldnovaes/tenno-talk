-- A change of receiving language applies only to messages sent after it (PLAN.md §21): each
-- message is shown in the language its reader had when it was sent, so old conversations are
-- never translated again.
CREATE TABLE receiving_language_history (
    user_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    language TEXT        NOT NULL,
    since    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, since)
);

-- Baseline: the current language since the account was created.
INSERT INTO receiving_language_history (user_id, language, since)
SELECT p.user_id, p.receiving_language, u.created_at
FROM user_preferences p
JOIN users u ON u.id = p.user_id;
