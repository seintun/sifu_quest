-- Atomic memory file upsert with automatic version bumping.
-- Eliminates the read-then-write race condition in writeMemoryFile().
-- Also inserts the audit trail row in a single transaction.

CREATE OR REPLACE FUNCTION upsert_memory_file_atomic(
  filename_param TEXT,
  content_param TEXT,
  change_source_param TEXT DEFAULT 'manual'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_version INT;
  next_version INT;
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Advisory lock keyed on user+filename hash to serialize concurrent calls.
  -- Prevents the race where two concurrent calls both see NULL current_version
  -- and both compute next_version = 1.
  PERFORM pg_advisory_xact_lock(
    hashtext(caller_id::text || ':' || filename_param)
  );

  -- Lock the row for this user+filename pair to prevent concurrent writes.
  -- If no row exists, we start at version 1.
  SELECT version INTO current_version
  FROM memory_files
  WHERE user_id = caller_id AND filename = filename_param
  FOR UPDATE;

  next_version := COALESCE(current_version, 0) + 1;

  -- Upsert the memory file with atomic version bump
  INSERT INTO memory_files (user_id, filename, content, version, updated_at)
  VALUES (caller_id, filename_param, content_param, next_version, now())
  ON CONFLICT (user_id, filename)
  DO UPDATE SET
    content = EXCLUDED.content,
    version = next_version,
    updated_at = now();

  -- Insert audit trail row
  INSERT INTO memory_file_versions (user_id, filename, content, version, change_source, changed_at)
  VALUES (caller_id, filename_param, content_param, next_version, change_source_param, now());
END;
$$;

-- Grant execute to authenticated users (function now uses auth.uid() internally,
-- so users can only write their own memory files) and to service_role.
GRANT EXECUTE ON FUNCTION upsert_memory_file_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_memory_file_atomic TO service_role;
