# Technical Architecture
> Overview of Sifu Quest runtime, infrastructure, and core modules.
>
> See also: [Provider, Pricing, and Telemetry Technical Decision Roadmap](./provider-pricing-roadmap.md) for the planned OpenRouter + Anthropic rollout, quota policy, and usage telemetry design.
> See also: [Onboarding V2 Technical Decisions](./onboarding-v2-technical-decisions.md) for queueing, refresh, and migration/error-handling decisions.

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
    ┌────┴────────────────────────────────────────────┐
    │              LLM Provider Layer                │
    │      OpenRouter, Anthropic, future providers   │
    └─────────────────────────────────────────────────┘
```

**Request lifecycle:**

1. User opens a page → Next.js serves the React app (static or dynamic).
2. Client-side actions hit `/api/*` routes running on Node.js serverless functions.
3. Each API route authenticates the user via **NextAuth** (`web/src/auth.ts`).
4. Authenticated routes read/write data to **Supabase PostgreSQL** via `@supabase/ssr`.
5. Chat routes stream responses from the selected provider (OpenRouter or Anthropic).
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
| LLM              | Multi-provider chat (OpenRouter + Anthropic; extensible) | —       |
| Monitoring       | Sentry (`@sentry/nextjs`)               | 10.x       |
| Hosting          | Vercel                                  | —          |
| Encryption       | Node.js `crypto` (AES-256-GCM)          | built-in   |


## API Route Reference

All routes live under `src/app/api/` and require authentication via `auth()` from `web/src/auth.ts`.

| Route                            | Method | Purpose                                        |
| -------------------------------- | ------ | ---------------------------------------------- |
| `/api/auth/[...nextauth]`        | *      | NextAuth handler (Google + Anonymous login)    |
| `/api/auth/apikey`               | POST/DELETE | Save or delete encrypted provider API keys (OpenRouter/Anthropic) |
| `/api/account`                   | DELETE | GDPR-compliant full account wipe               |
| `/api/chat`                      | POST   | Stream provider responses (SSE)                 |
| `/api/chat/session`              | GET/POST | Fetch or create chat sessions               |
| `/api/dsa/log`                   | POST   | Log a DSA problem to memory + progress         |
| `/api/encrypt-key`               | POST   | Utility: encrypt an API key                    |
| `/api/jobs`                      | POST   | Log job application updates                    |
| `/api/link-google/callback`      | GET    | Supabase OAuth callback for identity linking   |
| `/api/memory`                    | GET    | Read memory files or list all files            |
| `/api/onboarding`                | POST   | Legacy compatibility shim for onboarding submit |
| `/api/onboarding/draft`          | PATCH  | Autosave onboarding draft state                 |
| `/api/onboarding/core/complete`  | POST   | Complete core onboarding and queue plan job     |
| `/api/onboarding/enrichment`     | POST   | Save incremental enrichment answers; set plan status to `not_queued` (no auto requeue) |
| `/api/onboarding/status`         | GET    | Fetch onboarding + plan status and resume draft |
| `/api/internal/plan-jobs/run`    | POST   | Worker endpoint to process queued onboarding plans |
| `/api/plan/toggle`               | POST   | Toggle plan checklist items                    |
| `/api/progress`                  | GET    | Compute dashboard metrics (streak, counters)   |
| `/api/progress/events`           | GET    | Raw progress events for calendar heatmap       |
| `/api/system-design/log`         | POST   | Log system design concept to memory            |

| `/api/guest-upgrade/token`       | POST   | Issue short-lived JWT for guest—>Google upgrade |
| `/api/guest-upgrade/complete`    | GET    | Merge guest data after Google OAuth; redirects to `/settings?success=linked` |
| `/api/account/status`            | GET    | Unified account + onboarding status (used by AuthStatusContext) |

---

## Authentication & Session Management

Sifu Quest operates a **dual-session model**: a Supabase session (cookie-based, used by server-side data operations) and a NextAuth JWT session (used for page routing and client-side identity).

### User Types

| Type | How signed in | `is_guest` flag | Session expires |
|---|---|---|---|
| **Guest** | Anonymous Supabase sign-in via NextAuth CredentialsProvider | `true` | 2 hours |
| **Google** | Google OAuth via NextAuth + Supabase | `false` | NextAuth JWT expiry |

### Route Protection

All dashboard routes (`/coach`, `/plan`, `/settings`, `/memory`, etc.) are protected by a **Next.js Edge Middleware** at `src/middleware.ts`:

```
unauthenticated request → middleware → redirect /login
authenticated request   → middleware → passes through to dashboard
```

Excluded paths: `/login`, `/api/auth/**`, `/_next/**`, `/favicon.ico`

### Logout Flow

Sign-out tears down both sessions in order:

1. `supabase.auth.signOut()` — destroys the Supabase cookie first
2. `next-auth signOut({ callbackUrl: '/login' })` — clears the NextAuth JWT and redirects

> ⚠️ Order matters: reversing it leaves a dangling Supabase session that would still be readable server-side until it expires naturally.

Different dialog is shown depending on user type:
- **Guest users** → `GuestLogoutDialog` with prominent "Create Account & Link Google" upgrade CTA
- **Google users** → `LogoutConfirmDialog` with simple confirmation

### Guest → Google Conversion Flow

When a guest user clicks "Create Account & Link Google":

```mermaid
flowchart TD
  CTA["Create Account & Link Google"] --> TOKEN["POST /api/guest-upgrade/token\n(creates short-lived JWT with guestUserId)"]
  TOKEN --> OAUTH["next-auth signIn('google')\ncallbackUrl = /api/guest-upgrade/complete?token=..."]
  OAUTH --> GOOGLE["Google OAuth consent screen"]
  GOOGLE --> NEXTAUTH_CB["next-auth /api/auth/callback/google\n(new Google session created)"]
  NEXTAUTH_CB --> COMPLETE["GET /api/guest-upgrade/complete?token=..."]
  COMPLETE --> VERIFY["verifyGuestUpgradeToken(token)\n→ extract guestUserId"]
  VERIFY --> MERGE["mergeGuestDataIntoUser(guestId, googleId)"]
  MERGE --> SETTINGS["/settings?success=linked"]

  MERGE --> M1["Copy memory_files"]
  MERGE --> M2["Copy onboarding_* columns\n(status, draft, completion %)"]
  MERGE --> M3["Prefer guest display_name\n(real onboarding name)"]
  MERGE --> M4["Transfer chat_sessions,\nchat_messages, progress_events"]
  MERGE --> M5["Delete guest profile\n+ Supabase auth user"]
```

After merge the user lands on `/settings?success=linked` with:
- All memories intact
- Onboarding status preserved (no re-onboarding)
- Display name from onboarding retained

---



Located in `src/lib/`:

| Module               | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `supabase.ts`        | Creates a **server-side** Supabase client using `@supabase/ssr` with cookie-based auth. Only usable in Server Components and API routes. |
| `supabase-browser.ts`| Creates a **browser-side** Supabase client using `createBrowserClient`. Used in Client Components (e.g., Settings page for `linkIdentity`). |
| `memory.ts`          | Reads/writes memory files from Supabase. Reads mode files from the filesystem (`src/modes/`). |
| `apikey.ts`          | Encrypts user-provided provider keys (for example `sk-ant-...`, `sk-or-...`) with **AES-256-GCM** before storage. Decrypts only at request-time. Supports legacy AES-256-CBC decryption. |
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

## Branding, SEO, and AI Tone Architecture

Sifu Quest centralizes branding and tone logic so UI copy, metadata, and AI behavior stay consistent:

- Branding constants in `web/src/lib/brand.ts` (for example `BRAND_NAME`, `BRAND_TAGLINE`, `BRAND_EMOJIS`, `NAV_COPY`)
- SEO metadata exports in `web/src/lib/brand.ts` (for example `BRAND_DESCRIPTION`, `APP_KEYWORDS`, `getCanonicalSiteUrl`)
- AI tone helper `buildSifuMasterToneGuidelines` used by chat system prompt assembly
- Metadata routes (`manifest`, `robots`, `sitemap`) that consume the shared branding/SEO exports

```mermaid
flowchart LR
  A["Brand Contracts (brand.ts)"] --> B["App Metadata (layout.tsx)"]
  A --> C["AI Tone Layer (chat system prompt)"]
  A --> D["Navigation + UI Labels"]
  B --> E["manifest / robots / sitemap"]
  D --> F["Dashboard + Ask Sifu UX"]
  C --> G["Sifu Master Responses"]
  E --> H["Search Engine Discoverability"]
  F --> I["Consistent Product Branding"]
  G --> I
```

---



Sentry is initialized across three runtimes:

| Config File              | Runtime | Default Production Sample Rate |
| ------------------------ | ------- | ------------------------------ |
| `sentry.client.config.ts`| Browser | 10% (`0.1`)                    |
| `sentry.server.config.ts`| Node.js | 10% (`0.1`)                    |
| `sentry.edge.config.ts`  | Edge    | 20% (`0.2`)                    |

Sample rates are configurable via `SENTRY_TRACES_SAMPLE_RATE` (server/edge) or `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (client) environment variables. In development, all three default to `1.0` (100%).

The Sentry webpack plugin (`withSentryConfig` in `next.config.ts`) uploads source maps and enables Vercel Cron monitoring automatically.

---


The following diagram illustrates the enforcement of message limits and API keys within the Sifu Quest chat application:

```mermaid
flowchart TD
    User(["User"]) --> ChatUI["Chat UI"]
    ChatUI --> |Send Message| API_Route["app/api/chat/route.ts"]
    
    API_Route --> FetchProfile[("Fetch User Profile")]
    FetchProfile --> CheckProfile{"Check User Profile
(is_guest?)"}
    
    %% Guest Flow
    CheckProfile -->|Guest| CheckExpiry{"Check Guest Expiry
(> 2 hours?)"}
    CheckExpiry -->|Expired| Error_Expired["403: session_expired"]
    CheckExpiry -->|Valid| SetFreeKey["Set API Key = Platform Key"]
    
    %% Logged-in Flow
    CheckProfile -->|Registered| CheckAppKey{"Has User API Key?"}
    CheckAppKey -->|Yes| SetUserKey["Set API Key = User Key"]
    CheckAppKey -->|No| SetFreeKey
    
    %% Shared Free Key Logic
    SetFreeKey --> CheckQuotaFlag{"Profile Flag:
free_quota_exhausted?"}
    CheckQuotaFlag -->|True| DetermineLimitError
    CheckQuotaFlag -->|False| LimitCheck{"DB Query:
SUM(Session Messages) >= 10?"}
    
    LimitCheck -->|Yes| UpdateFlag[("Update DB:
free_quota_exhausted = true")]
    UpdateFlag --> DetermineLimitError
    
    LimitCheck -->|No| SendToAnthropic
    
    DetermineLimitError{"Is Guest?"}
    DetermineLimitError -->|Yes| Error_GuestLimit["403: guest_limit_reached"]
    DetermineLimitError -->|No| Error_MissingKey["403: missing_api_key"]
    
    %% Success Path
    SetUserKey --> SendToAnthropic
    SendToAnthropic["Send to Anthropic API"] --> StreamResponse["Stream Response Back"]
    StreamResponse --> UpdateDB[("Update Supabase DB counts")]
    
    %% UI Rendering based on Errors
    Error_GuestLimit -.-> |Updates UI State| HookState["useChat: upgradeRequired = 'guest_limit_reached'"]
    Error_MissingKey -.-> |Updates UI State| HookState2["useChat: upgradeRequired = 'missing_api_key'"]
    
    HookState --> RenderUpgrade["Render UpgradePrompt
(Sign Up CTA)"]
    HookState2 --> RenderApiKey["Render ApiKeyPrompt
(Go to Settings CTA)"]

    classDef error fill:#f8d7da,stroke:#f5c2c7,stroke-width:2px,color:#842029
    classDef success fill:#d1e7dd,stroke:#badbcc,stroke-width:2px,color:#0f5132
    classDef process fill:#cfe2ff,stroke:#b6d4fe,stroke-width:2px,color:#084298
    classDef db fill:#fcf8e3,stroke:#faebcc,stroke-width:2px,color:#8a6d3b
    
    class Error_Expired,Error_GuestLimit,Error_MissingKey error
    class SendToAnthropic,StreamResponse success
    class FetchProfile,UpdateFlag,UpdateDB db
    class SetFreeKey,SetUserKey process
```
