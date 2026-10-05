-- "Who can see when I'm online" (PLAN.md §31.1): online indicator and last seen.
ALTER TABLE user_preferences ADD COLUMN who_can_see_online TEXT NOT NULL DEFAULT 'everyone'
    CHECK (who_can_see_online IN ('everyone', 'followers', 'nobody'));
