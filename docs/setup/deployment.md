# Production Deployment

## Vercel Production Deployment

### 1. Push Database Schema

Before the app can save any data, you must push the schema to your hosted Supabase project:

```bash
# Log in to the Supabase CLI (this will open your browser)
npx supabase login

# Link your local repo to your hosted Supabase project
npx supabase link --project-ref your-project-ref-id

# Push the schema to create the tables
npx supabase db push
```

> You can find your **Project ID** in the Supabase Dashboard URL (e.g., `https://supabase.com/dashboard/project/your-project-ref-id`).

### 2. Import the Repository

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Click **Add New → Project**.
3. Select the `sifu_quest` GitHub repository.
4. Under **Configure Project**:
   - **Root Directory**: `web`
   - **Framework Preset**: `Next.js`
   - **Build Command**: `next build` (default)
   - **Output Directory**: `.next` (default)
5. Click **Deploy** (the first deploy will fail without env vars — that's fine).

### 2. Add Environment Variables

Go to **Settings → Environment Variables** and add each variable:

| Variable                               | Value Source                          | Environments       |
| -------------------------------------- | ------------------------------------- | ------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase dashboard → Settings → API  | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase dashboard → Settings → API  | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY`            | Supabase dashboard → Settings → API  | Production, Preview |
| `SIFU_OPENROUTER_API_KEY`               | OpenRouter Keys                      | Production, Preview |
| `SIFU_ANTHROPIC_API_KEY`                | Anthropic Console → API Keys         | Production, Preview |
| `API_KEY_ENCRYPTION_SECRET`            | `openssl rand -hex 32`               | Production, Preview |
| `NEXTAUTH_SECRET`                      | `openssl rand -base64 32`            | Production, Preview |
| `NEXTAUTH_URL`                         | Your Vercel URL                      | Production          |
| `GOOGLE_CLIENT_ID`                     | Google Cloud Console                 | Production, Preview |
| `GOOGLE_CLIENT_SECRET`                 | Google Cloud Console                 | Production, Preview |
| `NEXT_PUBLIC_SENTRY_DSN`              | Sentry project settings              | Production, Preview |

### 3. Configure External Services for Production

#### Google Cloud Console
Add the production redirect URI:
```
https://your-app.vercel.app/api/auth/callback/google
```

#### Supabase Dashboard
1. **Authentication → URL Configuration**:
   - Set **Site URL** to `https://your-app.vercel.app`
   - Add `https://your-app.vercel.app/api/link-google/callback` to **Redirect URLs**
2. **Authentication → Providers → Google**:
   - Paste production `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

### 4. Redeploy

After adding all environment variables, trigger a redeploy:
- Go to **Deployments** → click the three-dot menu on the latest → **Redeploy**.

### 5. Post-Deployment Verification

- [ ] Visit `https://your-app.vercel.app` — landing page loads
- [ ] Click **Login with Google** — redirects to Google, returns authenticated
- [ ] Start without a personal key — shared OpenRouter free path is available and free quota is enforced (current rollout: 25 messages)
- [ ] Save an API key in Settings — verify it encrypts and round-trips
- [ ] Delete your account — confirm all data is wiped (GDPR)
- [ ] Check Sentry dashboard — errors and traces appear

---

---


After deploy, verify the following end-to-end:

1. Log in as a fresh user without personal key:
   - You can send messages through shared OpenRouter free models.
   - The 11th user message is blocked by free-tier quota.
2. Verify guest sessions enforce expiry independently of free-tier quota.
3. Open **Settings**:
   - Save personal provider key(s) and verify chat unblocks.
   - Remove key and verify trial status is shown again.
   - Confirm infra env status list shows configured/missing key names only (no secret values).
4. Open Memory pages and verify data is loaded from Supabase `memory_files`.

---

**Once configured and the schema is pushed, simply trigger a Vercel deployment of the `main` branch to go live!**
