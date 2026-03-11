CREATE OR REPLACE FUNCTION persist_chat_turn(
  session_id_param UUID,
  user_id_param UUID,
  user_content_param TEXT,
  assistant_content_param TEXT,
  provider_param TEXT,
  model_param TEXT,
  input_tokens_param INT DEFAULT 0,
  output_tokens_param INT DEFAULT 0,
  total_tokens_param INT DEFAULT 0,
  latency_ms_param INT DEFAULT NULL,
  estimated_cost_param BIGINT DEFAULT 0,
  request_id_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  owned_session BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM chat_sessions
    WHERE id = session_id_param
      AND user_id = user_id_param
  )
  INTO owned_session;

  IF NOT owned_session THEN
    RETURN FALSE;
  END IF;

  INSERT INTO chat_messages (
    session_id,
    user_id,
    role,
    content,
    provider,
    model
  ) VALUES (
    session_id_param,
    user_id_param,
    'user',
    user_content_param,
    provider_param,
    model_param
  );

  INSERT INTO chat_messages (
    session_id,
    user_id,
    role,
    content,
    provider,
    model,
    input_tokens,
    output_tokens,
    total_tokens,
    tokens_used,
    latency_ms,
    estimated_cost_microusd,
    request_id
  ) VALUES (
    session_id_param,
    user_id_param,
    'assistant',
    assistant_content_param,
    provider_param,
    model_param,
    GREATEST(COALESCE(input_tokens_param, 0), 0),
    GREATEST(COALESCE(output_tokens_param, 0), 0),
    GREATEST(COALESCE(total_tokens_param, 0), 0),
    GREATEST(COALESCE(total_tokens_param, 0), 0),
    latency_ms_param,
    GREATEST(COALESCE(estimated_cost_param, 0), 0),
    request_id_param
  );

  UPDATE chat_sessions
  SET
    provider = COALESCE(provider_param, provider),
    model = COALESCE(model_param, model),
    message_count = COALESCE(message_count, 0) + 2,
    user_turns_count = COALESCE(user_turns_count, 0) + 1,
    input_tokens_total = COALESCE(input_tokens_total, 0) + GREATEST(COALESCE(input_tokens_param, 0), 0),
    output_tokens_total = COALESCE(output_tokens_total, 0) + GREATEST(COALESCE(output_tokens_param, 0), 0),
    total_tokens_total = COALESCE(total_tokens_total, 0) + GREATEST(COALESCE(total_tokens_param, 0), 0),
    estimated_cost_microusd_total = COALESCE(estimated_cost_microusd_total, 0) + GREATEST(COALESCE(estimated_cost_param, 0), 0),
    last_message_at = now()
  WHERE id = session_id_param
    AND user_id = user_id_param;

  UPDATE user_profiles
  SET
    default_provider = provider_param,
    default_model = model_param
  WHERE id = user_id_param
    AND (
      default_provider IS DISTINCT FROM provider_param
      OR default_model IS DISTINCT FROM model_param
    );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;
