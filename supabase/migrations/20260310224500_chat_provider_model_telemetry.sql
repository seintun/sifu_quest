-- Add provider/model defaults and multi-provider API key storage.
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS default_provider TEXT NOT NULL DEFAULT 'openrouter';

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS default_model TEXT;

CREATE TABLE IF NOT EXISTS user_api_keys (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openrouter')),
  api_key_enc TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_api_keys'
      AND policyname = 'own rows for provider api keys'
  ) THEN
    CREATE POLICY "own rows for provider api keys"
      ON user_api_keys
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Backfill Anthropic BYOK keys into the new provider-key table.
INSERT INTO user_api_keys (user_id, provider, api_key_enc)
SELECT id, 'anthropic', api_key_enc
FROM user_profiles
WHERE api_key_enc IS NOT NULL
ON CONFLICT (user_id, provider) DO UPDATE
SET
  api_key_enc = EXCLUDED.api_key_enc,
  updated_at = now();

-- Add session-level provider/model and aggregate usage metrics.
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS provider TEXT;

ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS model TEXT;

ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS user_turns_count INT NOT NULL DEFAULT 0;

ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS input_tokens_total INT NOT NULL DEFAULT 0;

ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS output_tokens_total INT NOT NULL DEFAULT 0;

ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS total_tokens_total INT NOT NULL DEFAULT 0;

ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS estimated_cost_microusd_total BIGINT NOT NULL DEFAULT 0;

UPDATE chat_sessions
SET provider = 'openrouter'
WHERE provider IS NULL;

UPDATE chat_sessions
SET model = 'openai/gpt-oss-20b:free'
WHERE model IS NULL;

ALTER TABLE chat_sessions
ALTER COLUMN provider SET NOT NULL;

ALTER TABLE chat_sessions
ALTER COLUMN model SET NOT NULL;

-- Add message-level provider/model and usage telemetry fields.
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS provider TEXT;

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS model TEXT;

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS input_tokens INT;

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS output_tokens INT;

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS total_tokens INT;

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS latency_ms INT;

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS estimated_cost_microusd BIGINT;

ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS request_id TEXT;

UPDATE chat_messages cm
SET
  provider = cs.provider,
  model = cs.model
FROM chat_sessions cs
WHERE cm.session_id = cs.id
  AND (cm.provider IS NULL OR cm.model IS NULL);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_provider_created
  ON chat_sessions (user_id, provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON chat_messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON chat_messages (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_provider_model_created
  ON chat_messages (user_id, provider, model, created_at DESC);

-- Atomically increment session usage counters post-response persistence.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
