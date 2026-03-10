# Production Vercel Deployment Guide

To deploy this Next.js app to Vercel, you need to populate the following Environment Variables in the Vercel Dashboard for your project.

## Runtime Model

- Supabase `memory_files` is the source of truth for user markdown memory/profile/plan data.
- Coaching modes are loaded from `web/src/modes/*.md`.
- Infrastructure secrets are env-only (`.env.local` locally, Vercel env in deploy).
- Personal Anthropic keys are user-managed in-app and stored encrypted in `user_profiles.api_key_enc`.
- Users without personal keys run in trial mode: **5 user messages within 30 minutes**.

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`: Your Supabase Anon / Publishable Key (safe for the browser).
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (used ONLY for the GDPR account deletion endpoint).

### Authentication & Keys
- `ANTHROPIC_API_KEY`: Shared guest/trial key used when a user has not saved a personal key.
- `API_KEY_ENCRYPTION_SECRET`: A 32-byte hex string used to encrypt the "Bring Your Own" user API keys in the database. Run `openssl rand -hex 32` to generate one.
- `NEXTAUTH_SECRET`: A 32-byte base64 string for encrypting NextAuth tokens. Run `openssl rand -base64 32`.
- `NEXTAUTH_URL`: Your Vercel production URL (e.g. `https://my-app.vercel.app`).
- `GOOGLE_CLIENT_ID`: OAuth Client ID from Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: OAuth Client Secret from Google Cloud Console.

### Monitoring
- `NEXT_PUBLIC_SENTRY_DSN`: Your Sentry DSN for performance and error monitoring tracking.

---

### Database Setup
Before the app can save any data, you must push the schema to your hosted Supabase project:
```bash
npx supabase login
npx supabase link --project-ref your-project-ref-id
npx supabase db push
```

---

### Verification Runbook

After deploy, verify the following end-to-end:

1. Log in as a fresh user without personal key:
   - You can send messages in trial mode.
   - The 6th user message is blocked with `trial_limit_reached`.
2. Wait 30+ minutes (or use test data) and verify trial expiry returns `trial_expired`.
3. Open **Settings**:
   - Save personal Anthropic key and verify chat unblocks.
   - Remove key and verify trial status is shown again.
   - Confirm infra env status list shows configured/missing key names only (no secret values).
4. Open Memory pages and verify data is loaded from Supabase `memory_files`.

---

**Once configured and the schema is pushed, simply trigger a Vercel deployment of the `main` branch to go live!**
