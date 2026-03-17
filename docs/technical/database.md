# Database & Authentication
> Overview of Supabase schema, NextAuth flow, and Security models.

## Authentication Flow

Authentication is managed by **NextAuth v5** (`web/src/auth.ts`) with two providers:

### 1. Google OAuth
- Standard OAuth 2.0 flow via Google Cloud Console credentials.
- On successful login, the user's `id` is stored in the JWT token and propagated to all API routes via `auth()`.

### 2. Anonymous (Guest)
- Uses a `CredentialsProvider` with id `"anonymous"`.
- On trigger, it calls `supabase.auth.signInAnonymously()` to create a temporary Supabase user.
- Trial-mode sessions (users without personal keys) are constrained server-side:
  - **2-hour window** — enforced via `user_profiles.guest_expires_at` (configurable via `GUEST_EXPIRY_MS` env var).
  - **25 user-message limit** — enforced via `user_profiles.trial_messages_used`.
- This trial policy applies to both guest and signed-in users until a personal key is saved.

### Guest → Google Upgrade
- The `/settings` page detects guest users and shows a "Link Google Account" CTA.
- Clicking it invokes `supabase.auth.linkIdentity({ provider: 'google' })`.
- The OAuth redirect lands on `/api/link-google/callback`, which exchanges the auth code for a Supabase session, completing the identity merge without data loss.

---


## Supabase Database Schema

The schema is defined across:
- `supabase/migrations/20260309230058_init_schema.sql` (base tables/policies)
- `supabase/migrations/20260310093000_add_trial_entitlements.sql` (trial columns)

It contains **7 tables**:

### `user_profiles`
| Column             | Type          | Notes                                       |
| ------------------ | ------------- | ------------------------------------------- |
| `id`               | UUID (PK)     | References `auth.users(id)`, cascading      |
| `display_name`     | TEXT          | —                                           |
| `avatar_url`       | TEXT          | —                                           |
| `is_guest`         | BOOLEAN       | Default `false`                             |
| `guest_expires_at` | TIMESTAMPTZ   | Legacy guest field                          |
| `api_key_enc`      | TEXT          | Legacy encrypted API key column (migrated to provider-key records) |
| `trial_started_at` | TIMESTAMPTZ   | Trial window start timestamp                |
| `trial_messages_used` | INT        | Number of user messages consumed in trial   |
| `created_at`       | TIMESTAMPTZ   | —                                           |
| `last_active_at`   | TIMESTAMPTZ   | —                                           |

### `memory_files`
Replaces the old local `*.md` file system. Each user has up to 8 memory files.

| Column      | Type     | Notes                      |
| ----------- | -------- | -------------------------- |
| `id`        | BIGSERIAL| PK                         |
| `user_id`   | UUID     | FK → `auth.users`          |
| `filename`  | TEXT     | e.g. `profile.md`, `plan.md` |
| `content`   | TEXT     | Raw markdown               |
| `version`   | INT      | Monotonically incremented  |
| `updated_at`| TIMESTAMPTZ | —                       |

**Unique constraint:** `(user_id, filename)`

### `memory_file_versions`
Audit trail for every memory file mutation. Tracks who changed what and why.

| Column          | Type     | Notes                                   |
| --------------- | -------- | --------------------------------------- |
| `change_source` | TEXT     | `onboarding`, `plan_toggle`, `dsa_log`, `chat`, etc. |

### `chat_sessions`
Groups chat conversations by coaching mode.

| Column          | Type     | Notes                         |
| --------------- | -------- | ----------------------------- |
| `id`            | UUID     | PK, auto-generated            |
| `user_id`       | UUID     | FK → `auth.users`             |
| `mode`          | TEXT     | Coaching mode (e.g. `dsa`)    |
| `message_count` | INT      | Conversation message count    |
| `is_archived`   | BOOLEAN  | —                             |

### `chat_messages`
Individual messages within a chat session.

| Column       | Type     | Notes                               |
| ------------ | -------- | ----------------------------------- |
| `session_id` | UUID     | FK → `chat_sessions`                |
| `role`       | TEXT     | `user` or `assistant` (CHECK)       |
| `content`    | TEXT     | Message body                        |
| `tokens_used`| INT      | (Optional) token consumption        |

### `progress_events`
Powers the dashboard streak calendar and activity heatmap.

| Column       | Type     | Notes                              |
| ------------ | -------- | ---------------------------------- |
| `event_type` | TEXT     | e.g. `dsa_problem_logged`, `plan_item_checked` |
| `domain`     | TEXT     | Feature area                       |
| `payload`    | JSONB    | Flexible metadata                  |
| `occurred_at`| TIMESTAMPTZ | —                               |

### `audit_log`
Tamper-evident record of sensitive operations.

| Column    | Type   | Notes                                     |
| --------- | ------ | ----------------------------------------- |
| `action`  | TEXT   | e.g. `api_key_saved`, `account_deleted`   |
| `resource`| TEXT   | Target entity                             |
| `details` | JSONB  | Additional context                        |

### Row Level Security (RLS)
RLS is **enabled on all tables** except `audit_log`. Each policy enforces `auth.uid() = user_id`, guaranteeing that User A can never read or write User B's data — even if they craft raw SQL queries.

---


| Concern                | Implementation                                                       |
| ---------------------- | --------------------------------------------------------------------- |
| **Data isolation**     | Supabase RLS on all user-facing tables (`auth.uid() = user_id`)       |
| **API key storage**    | Users provide provider keys (for example `sk-ant-...`, `sk-or-...`). The app encrypts keys server-side with AES-256-CBC and a random 16-byte IV per key. `API_KEY_ENCRYPTION_SECRET` is env-only and operator-managed. Plaintext is **never stored or logged**. |
| **Trial limits**       | 2-hour window + 25 user-message cap for users without personal keys, enforced **server-side** in `/api/chat` |
| **GDPR compliance**    | `DELETE /api/account` wipes all 7 tables + the `auth.users` row via Supabase Admin |
| **Session management** | JWT-based via NextAuth. Tokens carry only the user UUID.              |

---
