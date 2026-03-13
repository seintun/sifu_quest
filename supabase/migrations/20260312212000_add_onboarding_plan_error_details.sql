-- Add diagnostic details columns for onboarding plan generation
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_plan_error_details JSONB;

ALTER TABLE onboarding_plan_jobs
  ADD COLUMN IF NOT EXISTS last_error_details JSONB;

-- Update existing failed jobs to have empty details if null
UPDATE onboarding_plan_jobs
SET last_error_details = '{}'::jsonb
WHERE status = 'failed' AND last_error_details IS NULL;
