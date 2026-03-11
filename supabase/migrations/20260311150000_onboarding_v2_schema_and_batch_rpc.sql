ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS onboarding_version INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS onboarding_completion_percent INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_next_prompt_key TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_core_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_enriched_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_draft JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_last_step INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_plan_status TEXT NOT NULL DEFAULT 'not_queued',
  ADD COLUMN IF NOT EXISTS onboarding_plan_error_code TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_plan_retries INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_plan_last_attempt_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_onboarding_status_check'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_onboarding_status_check
      CHECK (onboarding_status IN ('not_started', 'in_progress', 'core_complete', 'enriched_complete'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_onboarding_plan_status_check'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_onboarding_plan_status_check
      CHECK (onboarding_plan_status IN ('not_queued', 'queued', 'running', 'ready', 'failed'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_profiles_onboarding_completion_percent_check'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_onboarding_completion_percent_check
      CHECK (onboarding_completion_percent BETWEEN 0 AND 100);
  END IF;
END
$$;

UPDATE user_profiles AS profile
SET
  onboarding_status = 'enriched_complete',
  onboarding_completion_percent = 100,
  onboarding_core_completed_at = COALESCE(onboarding_core_completed_at, now()),
  onboarding_enriched_completed_at = COALESCE(onboarding_enriched_completed_at, now()),
  onboarding_next_prompt_key = NULL
WHERE
  profile.onboarding_status = 'not_started'
  AND (
    (profile.display_name IS NOT NULL AND btrim(profile.display_name) <> '')
    OR EXISTS (
      SELECT 1
      FROM memory_files
      WHERE memory_files.user_id = profile.id
        AND memory_files.filename = 'profile.md'
        AND memory_files.content LIKE '%**Name:**%'
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_state
  ON user_profiles (onboarding_status, onboarding_plan_status);

CREATE TABLE IF NOT EXISTS onboarding_plan_jobs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_count INT NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'onboarding_plan_jobs_status_check'
  ) THEN
    ALTER TABLE onboarding_plan_jobs
      ADD CONSTRAINT onboarding_plan_jobs_status_check
      CHECK (status IN ('queued', 'running', 'completed', 'failed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_onboarding_plan_jobs_available
  ON onboarding_plan_jobs (status, available_at);

CREATE OR REPLACE FUNCTION bulk_upsert_memory_files(
  user_id_param UUID,
  entries_param JSONB,
  change_source_param TEXT DEFAULT 'manual'
)
RETURNS INT AS $$
DECLARE
  entry JSONB;
  filename_value TEXT;
  content_value TEXT;
  next_version INT;
  write_count INT := 0;
  allowed_files TEXT[] := ARRAY[
    'profile.md',
    'progress.md',
    'dsa-patterns.md',
    'job-search.md',
    'system-design.md',
    'plan.md',
    'corrections.md',
    'ideas.md'
  ];
BEGIN
  IF jsonb_typeof(entries_param) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'entries_param must be a JSON array of {filename, content} objects';
  END IF;

  FOR entry IN SELECT value FROM jsonb_array_elements(entries_param) LOOP
    filename_value := entry->>'filename';
    content_value := COALESCE(entry->>'content', '');

    IF filename_value IS NULL OR btrim(filename_value) = '' THEN
      CONTINUE;
    END IF;

    IF NOT filename_value = ANY(allowed_files) THEN
      RAISE EXCEPTION 'File not allowed: %', filename_value;
    END IF;

    INSERT INTO memory_files (
      user_id,
      filename,
      content,
      version,
      updated_at
    ) VALUES (
      user_id_param,
      filename_value,
      content_value,
      1,
      now()
    )
    ON CONFLICT (user_id, filename)
    DO UPDATE
      SET
        content = EXCLUDED.content,
        version = memory_files.version + 1,
        updated_at = now()
    RETURNING version INTO next_version;

    INSERT INTO memory_file_versions (
      user_id,
      filename,
      content,
      version,
      change_source
    ) VALUES (
      user_id_param,
      filename_value,
      content_value,
      next_version,
      change_source_param
    );

    write_count := write_count + 1;
  END LOOP;

  RETURN write_count;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;
