CREATE OR REPLACE FUNCTION public.increment_trial_messages_used(
  user_id_param UUID,
  increment_by INT DEFAULT 1
)
RETURNS TABLE(trial_messages_used INT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE user_profiles
  SET trial_messages_used = COALESCE(user_profiles.trial_messages_used, 0) + increment_by
  WHERE id = user_id_param
  RETURNING user_profiles.trial_messages_used;
END;
$$;

