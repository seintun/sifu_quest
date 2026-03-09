# AnthropiQ — Technical Documentation

> **Claude Thinking Buddy** (codename: AnthropiQ) is an AI-powered career coaching web application. It uses Claude (Anthropic) as the backbone LLM, Supabase for authentication and persistent storage, and is deployed globally on Vercel.

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
10. [Local Development Setup](#local-development-setup)
11. [Vercel Production Deployment](#vercel-production-deployment)
12. [Environment Variables Reference](#environment-variables-reference)

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
- Guest sessions are constrained:
  - **30-minute session TTL** — enforced server-side via `guest_expires_at`.
  - **5-message chat limit** — enforced server-side via `chat_sessions.message_count`.

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
| `guest_expires_at` | TIMESTAMPTZ   | 30-min TTL for guests                       |
| `api_key_enc`      | TEXT          | AES-256-CBC encrypted Anthropic API key     |
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
| `message_count` | INT      | Tracks guest message limits   |
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
| **Guest limits**       | 30-min TTL + 5-message cap, both enforced **server-side** in `/api/chat` |
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

## Local Development Setup

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Supabase CLI** (`npx supabase`)
- **Docker** (required for the local Supabase emulator)

### Step-by-step

```bash
# 1. Clone the repo
git clone https://github.com/seintun/claude_thinking_buddy.git
cd claude_thinking_buddy

# 2. Start the local Supabase instance (requires Docker)
npx supabase start

# The CLI will output your local keys:
#   API URL:    http://localhost:54321
#   anon key:   eyJ...
#   service_role key: eyJ...

# 3. Install Node dependencies
cd web
npm install

# 4. Create the .env.local file
cp .env.example .env.local  # or create manually (see below)

# 5. Apply the database migration
npx supabase db push

# 6. Run the development server
npm run dev
```

### `.env.local` Template

Create `web/.env.local` with the following:

```env
# Supabase (from `npx supabase start` output)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>

# Anthropic — used ONLY for guest sessions (5-message cap)
ANTHROPIC_API_KEY=sk-ant-...

# Encryption — generate with: openssl rand -hex 32
API_KEY_ENCRYPTION_SECRET=<32-byte-hex-string>

# NextAuth — generate with: openssl rand -base64 32
NEXTAUTH_SECRET=<random-base64-string>
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Sentry (optional for local dev)
NEXT_PUBLIC_SENTRY_DSN=<your-sentry-dsn>
```

### Verifying the Setup

```bash
# Run the production build locally to catch any type errors
npm run build

# Start the production server
npm start
```

---

## Vercel Production Deployment

### 1. Connect your GitHub repo

Link the `claude_thinking_buddy` repository to a new Vercel project. Set the **Root Directory** to `web/` and the **Framework Preset** to `Next.js`.

### 2. Configure Environment Variables

Navigate to **Settings → Environment Variables** in the Vercel dashboard and add:

| Variable                                | Scope       | How to Generate                               |
| --------------------------------------- | ----------- | --------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | All         | From Supabase dashboard → Settings → API      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`         | All         | From Supabase dashboard → Settings → API      |
| `SUPABASE_SERVICE_ROLE_KEY`             | Server only | From Supabase dashboard → Settings → API      |
| `ANTHROPIC_API_KEY`                     | Server only | From Anthropic Console                        |
| `API_KEY_ENCRYPTION_SECRET`             | Server only | `openssl rand -hex 32`                        |
| `NEXTAUTH_SECRET`                       | Server only | `openssl rand -base64 32`                     |
| `NEXTAUTH_URL`                          | All         | Your Vercel production URL (e.g. `https://my-app.vercel.app`) |
| `GOOGLE_CLIENT_ID`                      | All         | From Google Cloud Console → OAuth 2.0         |
| `GOOGLE_CLIENT_SECRET`                  | Server only | From Google Cloud Console → OAuth 2.0         |
| `NEXT_PUBLIC_SENTRY_DSN`                | All         | From Sentry project settings                  |
| `SENTRY_ORG` *(optional)*              | Server only | Overrides the default Sentry org              |
| `SENTRY_PROJECT` *(optional)*          | Server only | Overrides the default Sentry project          |
| `SENTRY_TRACES_SAMPLE_RATE` *(optional)*| Server only | Float between 0–1 (default: `0.1`)            |

### 3. Configure Google OAuth Redirect URIs

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add these **Authorized redirect URIs**:

```
https://your-app.vercel.app/api/auth/callback/google
```

### 4. Configure Supabase Auth

In the Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: Add `https://your-app.vercel.app/api/link-google/callback`

Also, enable the **Google** provider under **Authentication → Providers** with the same client ID/secret.

### 5. Deploy

Push to `main` and Vercel will automatically build and serve the application globally. Alternatively:

```bash
vercel deploy --prod
```

### 6. Post-Deployment Checklist

- [ ] Verify Google login works end-to-end
- [ ] Verify anonymous guest sessions are limited to 5 messages
- [ ] Verify API key encryption round-trip (save in Settings, use in Chat)
- [ ] Verify `DELETE /api/account` wipes all user data
- [ ] Check Sentry dashboard for incoming error/performance telemetry
- [ ] Consider upgrading Supabase to **Pro tier** ($25/mo) to prevent free-tier inactivity pauses

---

## Environment Variables Reference

A quick lookup for all environment variables used by the application:

| Variable                               | Required | Client-safe | Description                                |
| -------------------------------------- | -------- | ----------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | ✅       | ✅          | Supabase project URL                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | ✅       | ✅          | Supabase anon/public key                   |
| `SUPABASE_SERVICE_ROLE_KEY`            | ✅       | ❌          | Admin key for GDPR account deletion        |
| `ANTHROPIC_API_KEY`                    | ✅       | ❌          | Default key for guest chat sessions        |
| `API_KEY_ENCRYPTION_SECRET`            | ✅       | ❌          | 32-byte hex for AES-256-CBC encryption     |
| `NEXTAUTH_SECRET`                      | ✅       | ❌          | JWT signing secret for NextAuth            |
| `NEXTAUTH_URL`                         | ✅       | ❌          | Canonical app URL                          |
| `GOOGLE_CLIENT_ID`                     | ✅       | ❌          | Google OAuth client ID                     |
| `GOOGLE_CLIENT_SECRET`                 | ✅       | ❌          | Google OAuth client secret                 |
| `NEXT_PUBLIC_SENTRY_DSN`              | Optional | ✅          | Sentry data source name                    |
| `SENTRY_ORG`                          | Optional | ❌          | Sentry organization slug                   |
| `SENTRY_PROJECT`                      | Optional | ❌          | Sentry project slug                        |
| `SENTRY_TRACES_SAMPLE_RATE`           | Optional | ❌          | Server/edge trace sample rate (0–1)        |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`| Optional | ✅          | Client trace sample rate (0–1)             |
