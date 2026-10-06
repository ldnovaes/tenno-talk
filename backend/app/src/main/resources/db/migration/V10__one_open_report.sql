-- One open report per person and target (PLAN.md §31), also under concurrent requests (a double tap).
-- Duplicates left by the old check-then-insert keep the oldest open report; the others are closed as dismissed.
UPDATE reports r SET status = 'dismissed'
WHERE r.status = 'open'
  AND EXISTS (
      SELECT 1 FROM reports older
      WHERE older.status = 'open' AND older.reporter_id = r.reporter_id AND older.target_kind = r.target_kind
        AND older.target_id = r.target_id AND (older.created_at, older.id) < (r.created_at, r.id));

CREATE UNIQUE INDEX reports_one_open ON reports (reporter_id, target_kind, target_id) WHERE status = 'open';
