-- Snapshot recipients at insertion; socket writes are not delivery acknowledgements.
CREATE TABLE message_receipts (
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivered_at timestamptz,
    read_at timestamptz,
    PRIMARY KEY (message_id, recipient_id)
);
-- Historical messages had no device ACK. Preserve only actual read cursors; the old
-- delivered cursor was optimistic and must not become a confirmed receipt.
INSERT INTO message_receipts(message_id, recipient_id, delivered_at, read_at)
SELECT m.id, cm.user_id,
       CASE WHEN boundary.id IS NOT NULL AND (m.created_at, m.id) <= (boundary.created_at, boundary.id) THEN now() END,
       CASE WHEN boundary.id IS NOT NULL AND (m.created_at, m.id) <= (boundary.created_at, boundary.id) THEN now() END
FROM messages m
JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id <> m.sender_id
LEFT JOIN messages boundary ON boundary.id = cm.last_read_message_id;

CREATE TABLE realtime_jobs (
    id bigserial PRIMARY KEY,
    kind text NOT NULL,
    payload text NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX realtime_jobs_due ON realtime_jobs(available_at, id);
CREATE UNIQUE INDEX notification_message_once ON notifications(recipient_id, message_id) WHERE message_id IS NOT NULL;
CREATE TABLE push_subscriptions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint text NOT NULL UNIQUE,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE push_deliveries (
    notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    subscription_id uuid NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
    PRIMARY KEY(notification_id, subscription_id)
);
ALTER TABLE comments ADD COLUMN client_id varchar(100);
CREATE UNIQUE INDEX comment_client_once ON comments(author_id, client_id) WHERE client_id IS NOT NULL;
CREATE TABLE push_jobs (
    notification_id uuid PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
    attempts integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT now()
);
