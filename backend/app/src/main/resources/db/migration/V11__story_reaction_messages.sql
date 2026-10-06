-- A story reaction is a direct message (PLAN.md §9.9, like Instagram): the emoji goes in original_text, the story
-- in story_id. It is never translated.
ALTER TABLE messages DROP CONSTRAINT messages_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_type_check
    CHECK (type IN ('text', 'image', 'video', 'file', 'story_reply', 'story_reaction'));
