import { createBrowserClient } from '@supabase/ssr'

export function createClientBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      global: {
        headers: {
          'x-app-env': process.env.NEXT_PUBLIC_VERCEL_ENV || 'local',
        },
      },
    }
  )
}
