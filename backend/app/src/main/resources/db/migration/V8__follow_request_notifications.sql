-- Follow requests and their approval reach people as notifications (PLAN.md §15).
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('like', 'comment', 'follow', 'follow_request', 'follow_accepted', 'story_reaction', 'new_message'));
