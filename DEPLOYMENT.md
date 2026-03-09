# Production Vercel Deployment Guide

To deploy this Next.js app to Vercel, you need to populate the following Environment Variables in the Vercel Dashboard for your project.

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key (safe for the browser).
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (used ONLY for the GDPR account deletion endpoint).

### Authentication & Keys
- `ANTHROPIC_API_KEY`: The default key used for Guests (Note: Guest accounts are permanently limited to 5 lifetime messages).
- `API_KEY_ENCRYPTION_SECRET`: A 32-byte hex string used to encrypt the "Bring Your Own" user API keys in the database. Run `openssl rand -hex 32` to generate one.
- `NEXTAUTH_SECRET`: A 32-byte base64 string for encrypting NextAuth tokens. Run `openssl rand -base64 32`.
- `NEXTAUTH_URL`: Your Vercel production URL (e.g. `https://my-app.vercel.app`).
- `GOOGLE_CLIENT_ID`: OAuth Client ID from Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: OAuth Client Secret from Google Cloud Console.

### Monitoring
- `NEXT_PUBLIC_SENTRY_DSN`: Your Sentry DSN for performance and error monitoring tracking.

---

**Once configured, simply trigger a Vercel deployment of the `main` branch to go live!**
