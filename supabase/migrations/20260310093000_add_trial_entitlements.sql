ALTER TABLE user_profiles
  ADD COLUMN trial_started_at TIMESTAMPTZ,
  ADD COLUMN trial_messages_used INT NOT NULL DEFAULT 0;

