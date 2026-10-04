-- Translation moves from the subscription CLIs (codex, claude) to the APIs (PLAN.md §28.1, 2026-10-04).
-- Keys replace logins: needs_reauth / reauth_pending become invalid_key.
ALTER TABLE ai_provider_status DROP CONSTRAINT ai_provider_status_provider_check;
ALTER TABLE ai_provider_status DROP CONSTRAINT ai_provider_status_state_check;
DELETE FROM ai_provider_status;
ALTER TABLE ai_provider_status
    ADD CONSTRAINT ai_provider_status_provider_check CHECK (provider IN ('openai', 'anthropic')),
    ADD CONSTRAINT ai_provider_status_state_check CHECK (state IN ('ok', 'invalid_key', 'cooling_down'));
INSERT INTO ai_provider_status (provider) VALUES ('openai'), ('anthropic');

-- Jobs parked while the CLIs were logged out run again with the new providers.
UPDATE translation_jobs SET status = 'pending', run_after = now() WHERE status = 'waiting_provider';
