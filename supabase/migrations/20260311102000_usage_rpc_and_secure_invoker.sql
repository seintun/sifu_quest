CREATE OR REPLACE FUNCTION increment_chat_session_usage(
  session_id_param UUID,
  provider_param TEXT,
  model_param TEXT,
  user_turn_increment INT DEFAULT 1,
  input_tokens_increment INT DEFAULT 0,
  output_tokens_increment INT DEFAULT 0,
  total_tokens_increment INT DEFAULT 0,
  cost_increment BIGINT DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  UPDATE chat_sessions
  SET
    provider = COALESCE(provider_param, provider),
    model = COALESCE(model_param, model),
    user_turns_count = COALESCE(user_turns_count, 0) + GREATEST(user_turn_increment, 0),
    input_tokens_total = COALESCE(input_tokens_total, 0) + GREATEST(input_tokens_increment, 0),
    output_tokens_total = COALESCE(output_tokens_total, 0) + GREATEST(output_tokens_increment, 0),
    total_tokens_total = COALESCE(total_tokens_total, 0) + GREATEST(total_tokens_increment, 0),
    estimated_cost_microusd_total = COALESCE(estimated_cost_microusd_total, 0) + GREATEST(cost_increment, 0),
    last_message_at = now()
  WHERE id = session_id_param;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

CREATE OR REPLACE FUNCTION get_account_usage_aggregates(
  user_id_param UUID,
  cutoff_param TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days')
)
RETURNS JSONB
AS $$
WITH base AS (
  SELECT
    role,
    COALESCE(provider, 'unknown') AS provider,
    COALESCE(model, 'unknown') AS model,
    created_at,
    COALESCE(input_tokens, 0) AS input_tokens,
    COALESCE(output_tokens, 0) AS output_tokens,
    COALESCE(total_tokens, 0) AS total_tokens,
    COALESCE(estimated_cost_microusd, 0) AS estimated_cost_microusd
  FROM chat_messages
  WHERE user_id = user_id_param
),
lifetime AS (
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE role = 'user'), 0)::INT AS user_turns,
    COALESCE(COUNT(*) FILTER (WHERE role = 'assistant'), 0)::INT AS assistant_turns,
    COALESCE(SUM(input_tokens) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS input_tokens,
    COALESCE(SUM(output_tokens) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS output_tokens,
    COALESCE(SUM(total_tokens) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS total_tokens,
    COALESCE(SUM(estimated_cost_microusd) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS estimated_cost_microusd
  FROM base
),
trailing AS (
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE role = 'user' AND created_at >= cutoff_param), 0)::INT AS user_turns,
    COALESCE(COUNT(*) FILTER (WHERE role = 'assistant' AND created_at >= cutoff_param), 0)::INT AS assistant_turns,
    COALESCE(SUM(input_tokens) FILTER (WHERE role = 'assistant' AND created_at >= cutoff_param), 0)::BIGINT AS input_tokens,
    COALESCE(SUM(output_tokens) FILTER (WHERE role = 'assistant' AND created_at >= cutoff_param), 0)::BIGINT AS output_tokens,
    COALESCE(SUM(total_tokens) FILTER (WHERE role = 'assistant' AND created_at >= cutoff_param), 0)::BIGINT AS total_tokens,
    COALESCE(SUM(estimated_cost_microusd) FILTER (WHERE role = 'assistant' AND created_at >= cutoff_param), 0)::BIGINT AS estimated_cost_microusd
  FROM base
),
provider_breakdown AS (
  SELECT
    provider,
    COUNT(*) FILTER (WHERE role = 'user')::INT AS user_turns,
    COUNT(*) FILTER (WHERE role = 'assistant')::INT AS assistant_turns,
    COALESCE(SUM(input_tokens) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS input_tokens,
    COALESCE(SUM(output_tokens) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS output_tokens,
    COALESCE(SUM(total_tokens) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS total_tokens,
    COALESCE(SUM(estimated_cost_microusd) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS estimated_cost_microusd
  FROM base
  GROUP BY provider
),
model_breakdown AS (
  SELECT
    provider,
    model,
    COUNT(*) FILTER (WHERE role = 'user')::INT AS user_turns,
    COUNT(*) FILTER (WHERE role = 'assistant')::INT AS assistant_turns,
    COALESCE(SUM(input_tokens) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS input_tokens,
    COALESCE(SUM(output_tokens) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS output_tokens,
    COALESCE(SUM(total_tokens) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS total_tokens,
    COALESCE(SUM(estimated_cost_microusd) FILTER (WHERE role = 'assistant'), 0)::BIGINT AS estimated_cost_microusd
  FROM base
  GROUP BY provider, model
)
SELECT jsonb_build_object(
  'lifetime',
  jsonb_build_object(
    'userTurns', lifetime.user_turns,
    'assistantTurns', lifetime.assistant_turns,
    'inputTokens', lifetime.input_tokens,
    'outputTokens', lifetime.output_tokens,
    'totalTokens', lifetime.total_tokens,
    'estimatedCostMicrousd', lifetime.estimated_cost_microusd
  ),
  'trailing30Days',
  jsonb_build_object(
    'userTurns', trailing.user_turns,
    'assistantTurns', trailing.assistant_turns,
    'inputTokens', trailing.input_tokens,
    'outputTokens', trailing.output_tokens,
    'totalTokens', trailing.total_tokens,
    'estimatedCostMicrousd', trailing.estimated_cost_microusd
  ),
  'providerBreakdown',
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'provider', provider_breakdown.provider,
        'userTurns', provider_breakdown.user_turns,
        'assistantTurns', provider_breakdown.assistant_turns,
        'inputTokens', provider_breakdown.input_tokens,
        'outputTokens', provider_breakdown.output_tokens,
        'totalTokens', provider_breakdown.total_tokens,
        'estimatedCostMicrousd', provider_breakdown.estimated_cost_microusd
      )
      ORDER BY provider_breakdown.provider
    )
    FROM provider_breakdown
  ), '[]'::jsonb),
  'modelBreakdown',
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'provider', model_breakdown.provider,
        'model', model_breakdown.model,
        'userTurns', model_breakdown.user_turns,
        'assistantTurns', model_breakdown.assistant_turns,
        'inputTokens', model_breakdown.input_tokens,
        'outputTokens', model_breakdown.output_tokens,
        'totalTokens', model_breakdown.total_tokens,
        'estimatedCostMicrousd', model_breakdown.estimated_cost_microusd
      )
      ORDER BY model_breakdown.provider, model_breakdown.model
    )
    FROM model_breakdown
  ), '[]'::jsonb)
)
FROM lifetime, trailing;
$$ LANGUAGE sql SECURITY INVOKER SET search_path = public;
