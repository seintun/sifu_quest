# Sifu Quest — Technical Documentation

> **Sifu Quest** is an AI-powered career mastery web application. It uses Claude (Anthropic) as the backbone LLM, Supabase for authentication and persistent storage, and is deployed globally on Vercel.

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Technology Stack](#technology-stack)
3. [Authentication Flow](#authentication-flow)
4. [Supabase Database Schema](#supabase-database-schema)
5. [API Route Reference](#api-route-reference)
6. [Core Library Modules](#core-library-modules)
7. [Coaching Modes](#coaching-modes)
8. [Security Model](#security-model)
9. [Observability (Sentry)](#observability-sentry)
10. [Setup & Deployment](#setup--deployment) *(→ see [SETUP.md](./SETUP.md))*

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          VERCEL (Edge)                           │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Next.js   │  │  API Routes  │  │  Sentry (client/server/  │ │
│  │  App Router│──│  (Node.js)   │  │  edge monitoring)        │ │
│  │  (React)   │  │              │  └──────────────────────────┘ │
│  └─────┬──────┘  └──────┬───────┘                               │
│        │                │                                        │
└────────┼────────────────┼────────────────────────────────────────┘
         │                │
         │   ┌────────────┴───────────────────┐
         │   │         Supabase Cloud         │
         │   │                                │
         │   │  ┌─────────┐  ┌─────────────┐ │
         │   │  │  Auth   │  │  PostgreSQL  │ │
         │   │  │ (Google, │  │  (7 tables   │ │
         │   │  │  Anon)  │  │   with RLS)  │ │
         │   │  └─────────┘  └─────────────┘ │
         │   └────────────────────────────────┘
         │
    ┌────┴──────────┐
    │  Anthropic API │
    │  (Claude LLM)  │
    └────────────────┘
```

**Request lifecycle:**

1. User opens a page → Next.js serves the React app (static or dynamic).
2. Client-side actions hit `/api/*` routes running on Node.js serverless functions.
3. Each API route authenticates the user via **NextAuth** (`src/auth.ts`).
4. Authenticated routes read/write data to **Supabase PostgreSQL** via `@supabase/ssr`.
5. Chat routes stream responses from the **Anthropic Claude API**.
6. Errors across all runtimes are captured by **Sentry**.

---

## Technology Stack

| Layer            | Technology                              | Version    |
| ---------------- | --------------------------------------- | ---------- |
| Framework        | Next.js (App Router, Turbopack)         | 16.1.6     |
| Language         | TypeScript                              | 5.x        |
| UI               | React + Tailwind CSS                    | 19.x / 4.x |
| Auth             | NextAuth.js (v5 beta) + Supabase Auth   | 5.0-beta   |
| Database         | Supabase (PostgreSQL)                   | —          |
| LLM              | Anthropic Claude (via `@anthropic-ai/sdk`) | —       |
| Monitoring       | Sentry (`@sentry/nextjs`)               | 10.x       |
| Hosting          | Vercel                                  | —          |
| Encryption       | Node.js `crypto` (AES-256-CBC)          | built-in   |

---

## Authentication Flow

Authentication is managed by **NextAuth v5** (`src/auth.ts`) with two providers:

### 1. Google OAuth
- Standard OAuth 2.0 flow via Google Cloud Console credentials.
- On successful login, the user's `id` is stored in the JWT token and propagated to all API routes via `auth()`.

### 2. Anonymous (Guest)
- Uses a `CredentialsProvider` with id `"anonymous"`.
- On trigger, it calls `supabase.auth.signInAnonymously()` to create a temporary Supabase user.
- Trial-mode sessions (users without personal keys) are constrained server-side:
  - **30-minute window** — enforced via `user_profiles.trial_started_at`.
  - **5 user-message limit** — enforced via `user_profiles.trial_messages_used`.
- This trial policy applies to both guest and signed-in users until a personal key is saved.

### Guest → Google Upgrade
- The `/settings` page detects guest users and shows a "Link Google Account" CTA.
- Clicking it invokes `supabase.auth.linkIdentity({ provider: 'google' })`.
- The OAuth redirect lands on `/api/link-google/callback`, which exchanges the auth code for a Supabase session, completing the identity merge without data loss.

---

## Supabase Database Schema

The schema is defined in `supabase/migrations/20260309230058_init_schema.sql` and contains **7 tables**:

### `user_profiles`
| Column             | Type          | Notes                                       |
| ------------------ | ------------- | ------------------------------------------- |
| `id`               | UUID (PK)     | References `auth.users(id)`, cascading      |
| `display_name`     | TEXT          | —                                           |
| `avatar_url`       | TEXT          | —                                           |
| `is_guest`         | BOOLEAN       | Default `false`                             |
| `guest_expires_at` | TIMESTAMPTZ   | Legacy guest field                          |
| `api_key_enc`      | TEXT          | AES-256-CBC encrypted Anthropic API key     |
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

## API Route Reference

All routes live under `src/app/api/` and require authentication via `auth()` from `src/auth.ts`.

| Route                            | Method | Purpose                                        |
| -------------------------------- | ------ | ---------------------------------------------- |
| `/api/auth/[...nextauth]`        | *      | NextAuth handler (Google + Anonymous login)    |
| `/api/auth/apikey`               | POST/DELETE | Save or delete encrypted Anthropic API key |
| `/api/account`                   | DELETE | GDPR-compliant full account wipe               |
| `/api/chat`                      | POST   | Stream Claude responses (SSE)                  |
| `/api/chat/session`              | GET/POST | Fetch or create chat sessions               |
| `/api/dsa/log`                   | POST   | Log a DSA problem to memory + progress         |
| `/api/encrypt-key`               | POST   | Utility: encrypt an API key                    |
| `/api/jobs`                      | POST   | Log job application updates                    |
| `/api/link-google/callback`      | GET    | Supabase OAuth callback for identity linking   |
| `/api/memory`                    | GET    | Read memory files or list all files            |
| `/api/onboarding`                | POST   | Complete user onboarding, generate plan        |
| `/api/plan/toggle`               | POST   | Toggle plan checklist items                    |
| `/api/progress`                  | GET    | Compute dashboard metrics (streak, counters)   |
| `/api/progress/events`           | GET    | Raw progress events for calendar heatmap       |
| `/api/system-design/log`         | POST   | Log system design concept to memory            |

---

## Core Library Modules

Located in `src/lib/`:

| Module               | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `supabase.ts`        | Creates a **server-side** Supabase client using `@supabase/ssr` with cookie-based auth. Only usable in Server Components and API routes. |
| `supabase-browser.ts`| Creates a **browser-side** Supabase client using `createBrowserClient`. Used in Client Components (e.g., Settings page for `linkIdentity`). |
| `memory.ts`          | Reads/writes memory files from Supabase. Reads mode files from the filesystem (`src/modes/`). |
| `apikey.ts`          | Encrypts user API keys with **AES-256-CBC** before storage. Decrypts at chat-time. Uses a `randomBytes(16)` IV per encryption. |
| `progress.ts`        | Helper functions `logProgressEvent()` and `logAuditEvent()` for inserting rows into `progress_events` and `audit_log`. |
| `metrics.ts`         | Computes dashboard metrics (current streak, total activity days) by querying `progress_events` from Supabase. |

---

## Coaching Modes

Static markdown system prompts are stored in `src/modes/*.md`:

| File                  | Coaching Mode        |
| --------------------- | -------------------- |
| `dsa.md`              | DSA Problem Solving  |
| `interview-prep.md`   | Interview Prep       |
| `system-design.md`    | System Design        |
| `job-search.md`       | Job Search Strategy  |
| `business-ideas.md`   | Business Ideas       |

These files are read at runtime via `fs.readFile()` in `readModeFile()`. On Vercel, they are bundled into the serverless function's filesystem automatically as part of the Next.js build output.

---

## Security Model

| Concern                | Implementation                                                       |
| ---------------------- | --------------------------------------------------------------------- |
| **Data isolation**     | Supabase RLS on all user-facing tables (`auth.uid() = user_id`)       |
| **API key storage**    | AES-256-CBC encryption with a random 16-byte IV per key. The encryption secret is a 32-byte hex string stored in env vars. Plaintext is **never stored or logged**. |
| **Trial limits**       | 30-min window + 5 user-message cap for users without personal keys, enforced **server-side** in `/api/chat` |
| **GDPR compliance**    | `DELETE /api/account` wipes all 7 tables + the `auth.users` row via Supabase Admin |
| **Session management** | JWT-based via NextAuth. Tokens carry only the user UUID.              |

---

## Observability (Sentry)

Sentry is initialized across three runtimes:

| Config File              | Runtime | Default Production Sample Rate |
| ------------------------ | ------- | ------------------------------ |
| `sentry.client.config.ts`| Browser | 10% (`0.1`)                    |
| `sentry.server.config.ts`| Node.js | 10% (`0.1`)                    |
| `sentry.edge.config.ts`  | Edge    | 20% (`0.2`)                    |

Sample rates are configurable via `SENTRY_TRACES_SAMPLE_RATE` (server/edge) or `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (client) environment variables. In development, all three default to `1.0` (100%).

The Sentry webpack plugin (`withSentryConfig` in `next.config.ts`) uploads source maps and enables Vercel Cron monitoring automatically.

---

## Setup & Deployment

For detailed setup instructions — including how to obtain every API key from Google, Supabase, Anthropic, and Sentry — see the dedicated **[SETUP.md](./SETUP.md)** guide.

It covers:
- **Local Development** — Supabase emulator, `.env.local` configuration, `npm run dev`
- **Vercel Production** — Dashboard setup, environment variables, Google OAuth redirect URIs, Supabase Auth configuration, and a post-deployment checklist
- **Environment Variables Reference** — Full table of every variable with source and scope
