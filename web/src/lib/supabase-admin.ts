import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { assertRequiredEnv } from './env'

assertRequiredEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])

let adminClient: SupabaseClient | null = null

export function createAdminClient() {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        global: {
          headers: {
            'x-app-env': process.env.NEXT_PUBLIC_VERCEL_ENV || 'local',
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )
  }

  return adminClient
}
