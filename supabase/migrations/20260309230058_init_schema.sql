-- 1. User profiles
CREATE TABLE user_profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     TEXT,
  avatar_url       TEXT,
  is_guest         BOOLEAN DEFAULT false,
  guest_expires_at TIMESTAMPTZ,
  api_key_enc      TEXT,           -- AES-256 encrypted Anthropic key
  created_at       TIMESTAMPTZ DEFAULT now(),
  last_active_at   TIMESTAMPTZ DEFAULT now()
);

-- 2. Memory files (replaces local *.md files)
CREATE TABLE memory_files (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL,
  content    TEXT DEFAULT '',
  version    INT  DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, filename)
);

-- 3. Memory audit trail
CREATE TABLE memory_file_versions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL,
  filename      TEXT NOT NULL,
  content       TEXT,
  version       INT,
  change_source TEXT,   -- 'onboarding'|'plan_toggle'|'dsa_log'|'job_app'|'chat'
  changed_at    TIMESTAMPTZ DEFAULT now()
);

-- 4. Chat sessions
CREATE TABLE chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL,
  title           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  message_count   INT DEFAULT 0,
  is_archived     BOOLEAN DEFAULT false
);

-- 5. Chat messages
CREATE TABLE chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Progress events (powers streaks, calendar, dashboard)
CREATE TABLE progress_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  domain      TEXT,
  payload     JSONB,
  occurred_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Audit log
CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID,
  action     TEXT NOT NULL,
  resource   TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security on all tables
ALTER TABLE user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_files         ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_events      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own rows for profiles" ON user_profiles        USING (auth.uid() = id);
CREATE POLICY "own rows for memory" ON memory_files         USING (auth.uid() = user_id);
CREATE POLICY "own rows for memory versions" ON memory_file_versions USING (auth.uid() = user_id);
CREATE POLICY "own rows for chat sessions" ON chat_sessions        USING (auth.uid() = user_id);
CREATE POLICY "own rows for chat messages" ON chat_messages        USING (auth.uid() = user_id);
CREATE POLICY "own rows for progress" ON progress_events      USING (auth.uid() = user_id);
