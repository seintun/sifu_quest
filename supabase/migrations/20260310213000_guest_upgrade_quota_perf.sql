ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS free_user_messages_used INT NOT NULL DEFAULT 0;

-- Backfill from existing session message totals (2 rows per user turn)
UPDATE user_profiles up
SET free_user_messages_used = LEAST(
  COALESCE(
    (
      SELECT FLOOR(COALESCE(SUM(cs.message_count), 0) / 2.0)::INT
      FROM chat_sessions cs
      WHERE cs.user_id = up.id
    ),
    0
  ),
  5
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_mode_archived_created
  ON chat_sessions (user_id, mode, is_archived, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_user_created
  ON chat_messages (session_id, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
  ON chat_sessions (user_id);

CREATE OR REPLACE FUNCTION increment_user_free_usage(
  user_id_param UUID,
  increment_by INT DEFAULT 1,
  free_limit INT DEFAULT 5
)
RETURNS TABLE(free_user_messages_used INT, free_quota_exhausted BOOLEAN) AS $$
  UPDATE user_profiles
  SET
    free_user_messages_used = COALESCE(user_profiles.free_user_messages_used, 0) + increment_by,
    free_quota_exhausted = (COALESCE(user_profiles.free_user_messages_used, 0) + increment_by) >= free_limit
  WHERE id = user_id_param
  RETURNING user_profiles.free_user_messages_used, user_profiles.free_quota_exhausted;
$$ LANGUAGE sql;
