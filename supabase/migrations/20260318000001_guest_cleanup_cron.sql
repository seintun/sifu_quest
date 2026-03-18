-- Cleanup expired guest sessions
-- Deletes chat sessions, messages, memory files, memory versions, progress events,
-- and the user profile for guests whose guest_expires_at has passed.

CREATE OR REPLACE FUNCTION cleanup_expired_guests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_user RECORD;
  cleaned_count INTEGER := 0;
BEGIN
  FOR expired_user IN
    SELECT id FROM user_profiles
    WHERE is_guest = true
      AND guest_expires_at IS NOT NULL
      AND guest_expires_at < NOW()
  LOOP
    -- chat_messages are deleted via ON DELETE CASCADE on chat_sessions,
    -- but we also need to catch any orphaned messages referencing user_id directly.
    DELETE FROM chat_messages WHERE user_id = expired_user.id;

    -- Delete chat sessions (cascades to remaining chat_messages)
    DELETE FROM chat_sessions WHERE user_id = expired_user.id;

    -- Delete memory file versions
    DELETE FROM memory_file_versions WHERE user_id = expired_user.id;

    -- Delete memory files
    DELETE FROM memory_files WHERE user_id = expired_user.id;

    -- Delete progress events
    DELETE FROM progress_events WHERE user_id = expired_user.id;

    -- Delete audit log entries for this user
    DELETE FROM audit_log WHERE user_id = expired_user.id;

    -- Delete the user profile
    -- Note: auth.users must be deleted separately via admin API (e.g., supabase.auth.admin.deleteUser)
    -- since the FK runs from user_profiles -> auth.users, not the reverse.
    DELETE FROM user_profiles WHERE id = expired_user.id;

    cleaned_count := cleaned_count + 1;
  END LOOP;

  RETURN cleaned_count;
END;
$$;

-- Grant execute to service_role only (admin operations)
GRANT EXECUTE ON FUNCTION cleanup_expired_guests() TO service_role;

-- pg_cron setup (requires supabase extensions or manual enablement):
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   SELECT cron.schedule(
--     'cleanup-expired-guests',
--     '0 3 * * *',  -- every day at 3 AM UTC
--     $$SELECT cleanup_expired_guests()$$
--   );
--
-- To disable:  SELECT cron.unschedule('cleanup-expired-guests');
--
-- If pg_cron is not available, call the function manually or via the admin API endpoint.
