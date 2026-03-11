# Local Development Setup

## Prerequisites

| Tool       | Version  | Purpose                                |
| ---------- | -------- | -------------------------------------- |
| Node.js    | ≥ 20     | Runtime for Next.js                    |
| npm        | ≥ 10     | Package manager                        |
| Docker     | Latest   | Required for local Supabase emulator   |
| Git        | Latest   | Version control                        |
| Supabase CLI | Latest | Local Supabase development (`npx supabase`) |

---

## Obtaining API Keys & Secrets

### 1. Supabase

Supabase provides the PostgreSQL database and user authentication.

#### For Local Development (Emulator)

No account needed — the Supabase CLI spins up a local instance via Docker.

```bash
npx supabase start
```

After startup, the CLI prints your local keys:

```
API URL:         http://localhost:54321
anon key:        eyJ...  ← use as NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
service_role key: eyJ...  ← use as SUPABASE_SERVICE_ROLE_KEY
```

#### For Production (Hosted)

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account).
2. Click **New Project** → choose your organization → name it (e.g., `sifu-quest`) → set a database password → choose a region → click **Create**.
3. Wait for the project to finish provisioning (~2 minutes).
4. Navigate to **Settings → API** in the left sidebar.
5. Copy the following values:

| Dashboard Field         | Environment Variable              |
| ----------------------- | --------------------------------- |
| **Project URL**         | `NEXT_PUBLIC_SUPABASE_URL`        |
| **anon / public** key   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`   |
| **service_role** key    | `SUPABASE_SERVICE_ROLE_KEY`       |

> ⚠️ **Important:** The `service_role` key has full admin access to your database. Never expose it to the client. In Vercel, mark it as **Server only**.

#### Enable Anonymous Sign-In

1. In the Supabase dashboard → **Authentication → Configuration → Providers**.
2. Scroll to **Anonymous** and toggle **Enable Anonymous Sign-ins** to **ON**.
3. Click **Save**.

> 💡 **Why?** Sifu Quest requires this for guest sessions before users link a Google account. If disabled, onboarding will fail with an `anonymous_provider_disabled` error.

#### Enable Google Provider in Supabase Auth

1. In the Supabase dashboard → **Authentication → Configuration → Sign In / Providers → Auth providers**.
2. Find **Google** and toggle it **ON**.
3. Paste your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (see [Section 2](#2-google-oauth) below).
4. Add your production URL to the **Redirect URLs** list:
   ```
   https://your-app.vercel.app/api/link-google/callback
   ```
5. Under **Authentication → Configuration → URL Configuration**, set:
   - **Site URL**: `https://your-app.vercel.app`

---

### 2. Google OAuth

Google OAuth enables users to sign in with their Google account.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services → Credentials**.
4. Click **+ CREATE CREDENTIALS → OAuth client ID**.
5. If prompted, configure the **OAuth consent screen** first:
   - Choose **External** user type.
   - Fill in the app name, support email, and developer contact email.
   - Add the scopes: `openid`, `email`, `profile`.
   - Add your email as a test user (while in "Testing" status).
   - Click **Save and Continue** through all steps.
6. Back in **Credentials → + CREATE CREDENTIALS → OAuth client ID**:
   - **Application type**: Web application
   - **Name**: `Sifu Quest` (or any label)
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://your-app.vercel.app
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:3000/api/auth/callback/google
     https://your-app.vercel.app/api/auth/callback/google
     ```
   - Click **Create**.
7. Copy the displayed values:

| Google Console Field | Environment Variable    |
| -------------------- | ----------------------- |
| **Client ID**        | `GOOGLE_CLIENT_ID`      |
| **Client Secret**    | `GOOGLE_CLIENT_SECRET`  |

---

### 3. Provider Keys

OpenRouter powers shared free-tier chat. Anthropic is optional for server-side Anthropic features and user BYOK validation.

1. Go to [console.anthropic.com](https://console.anthropic.com/).
2. Sign in or create an account.
3. Navigate to **API Keys** in the left sidebar.
4. Click **Create Key** → give it a name (e.g., `sifu-quest-prod`) → click **Create**.
5. Copy the key immediately (it won't be shown again).

| Console Field | Environment Variable |
| ------------- | -------------------- |
| **OpenRouter API Key** | `OPENROUTER_API_KEY` |
| **Anthropic API Key** *(optional for local dev)* | `ANTHROPIC_API_KEY` |

> 💡 **Note:** `OPENROUTER_API_KEY` powers shared free-tier chat for guests and signed-in free users (current rollout limit: **10 user messages**). Users can add a personal Anthropic key in Settings to use Anthropic models.

---

### 4. Sentry (Optional)

Sentry provides error tracking and performance monitoring.

1. Go to [sentry.io](https://sentry.io/) and sign in (or create an account).
2. Click **Create Project** → select **Next.js** as the platform.
3. Name it (e.g., `sifu-quest-web`) → click **Create Project**.
4. On the setup page, copy the **DSN** value (looks like `https://abc123@o456.ingest.sentry.io/789`).

| Sentry Field      | Environment Variable             |
| ------------------ | -------------------------------- |
| **DSN**            | `NEXT_PUBLIC_SENTRY_DSN`         |
| **Organization**   | `SENTRY_ORG` *(optional)*       |
| **Project Slug**   | `SENTRY_PROJECT` *(optional)*   |

> You can also set `SENTRY_TRACES_SAMPLE_RATE` (server/edge, default `0.1`) and `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (client, default `0.1`) to control telemetry volume.

---

### 5. Application Secrets

These are cryptographic secrets generated locally — they don't come from any external service.

#### `API_KEY_ENCRYPTION_SECRET`

A server-only 32-byte hex string used to encrypt/decrypt user Anthropic API keys at rest.
End users do not provide this value; they only paste their Anthropic key (`sk-ant-...`) in Settings.

```bash
openssl rand -hex 32
```

Example output: `a1b2c3d4e5f6...` (64 hex characters)

> ⚠️ **Critical:** Use the **same secret** across all environments. If you rotate this, all previously encrypted user keys become unreadable until users re-save them.

#### `NEXTAUTH_SECRET`

A random string used by NextAuth to sign and encrypt JWT session tokens.

```bash
openssl rand -base64 32
```

Example output: `kF9x2mP7...` (44 base64 characters)

#### `NEXTAUTH_URL`

The canonical URL of your application:

- **Local**: `http://localhost:3000`
- **Production**: `https://your-app.vercel.app`

---

## Local Development Setup

Once you have all the keys from the sections above:

```bash
# 1. Clone the repository
git clone https://github.com/seintun/sifu_quest_buddy.git
cd sifu_quest_buddy

# 2. Start the local Supabase emulator (requires Docker running)
npx supabase start

# 3. Apply the database schema migration
npx supabase db push

# 4. Switch to the web application directory
cd web

# 5. Install dependencies
npm install

# 6. Create the .env.local file (see template below)
touch .env.local
```

### `.env.local` for Local Development

```env
# ── Supabase (from `npx supabase start` output) ──
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=<paste-local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<paste-local-service-role-key>

# ── LLM Provider Keys ──
OPENROUTER_API_KEY=sk-or-v1-...
ANTHROPIC_API_KEY=sk-ant-api03-...

# ── App Secrets ──
API_KEY_ENCRYPTION_SECRET=<paste-your-32-byte-hex>
NEXTAUTH_SECRET=<paste-your-base64-string>
NEXTAUTH_URL=http://localhost:3000

# ── Google OAuth ──
GOOGLE_CLIENT_ID=<paste-your-google-client-id>
GOOGLE_CLIENT_SECRET=<paste-your-google-client-secret>

# ── Sentry (optional) ──
# NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should be able to:
- Log in with Google or start an anonymous guest session
- Complete onboarding
- Chat in free-tier mode using `OPENROUTER_API_KEY` until quota is exhausted or a personal Anthropic key is added
- View your dashboard and calendar

### Verify the build compiles cleanly

```bash
npm run build
```

---

## Environment Variables Quick Reference

| Variable                                | Required | Client-safe | Source                |
| --------------------------------------- | -------- | ----------- | --------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | ✅       | ✅          | Supabase Dashboard    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`  | ✅       | ✅          | Supabase Dashboard    |
| `SUPABASE_SERVICE_ROLE_KEY`             | ✅       | ❌          | Supabase Dashboard    |
| `OPENROUTER_API_KEY`                    | ✅       | ❌          | OpenRouter Keys       |
| `ANTHROPIC_API_KEY`                     | ✅       | ❌          | Anthropic Console     |
| `API_KEY_ENCRYPTION_SECRET`             | ✅       | ❌          | `openssl rand -hex 32`|
| `NEXTAUTH_SECRET`                       | ✅       | ❌          | `openssl rand -base64 32` |
| `NEXTAUTH_URL`                          | ✅       | ❌          | Your app URL          |
| `GOOGLE_CLIENT_ID`                      | ✅       | ❌          | Google Cloud Console  |
| `GOOGLE_CLIENT_SECRET`                  | ✅       | ❌          | Google Cloud Console  |
| `NEXT_PUBLIC_SENTRY_DSN`               | Optional | ✅          | Sentry Dashboard      |
| `SENTRY_ORG`                           | Optional | ❌          | Sentry Dashboard      |
| `SENTRY_PROJECT`                       | Optional | ❌          | Sentry Dashboard      |
| `SENTRY_TRACES_SAMPLE_RATE`            | Optional | ❌          | Manual (float 0–1)    |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Optional | ✅          | Manual (float 0–1)    |
