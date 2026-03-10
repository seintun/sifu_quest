import { createClientBrowser } from './supabase-browser'
import { runGuestGoogleLink } from './guest-upgrade-core'

type GuestUpgradeDeps = {
  createClient: typeof createClientBrowser
}

export async function startGuestGoogleUpgrade(
  origin: string,
  deps: GuestUpgradeDeps = { createClient: createClientBrowser },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = deps.createClient()
  return runGuestGoogleLink(supabase.auth.linkIdentity.bind(supabase.auth), origin)
}
