import { createClientBrowser } from './supabase-browser'
import { runGuestGoogleLink } from './guest-upgrade-core'
import { signIn } from 'next-auth/react'

type GuestUpgradeDeps = {
  createClient: typeof createClientBrowser
}

export async function startGuestGoogleUpgrade(
  origin: string,
  deps: GuestUpgradeDeps = { createClient: createClientBrowser },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = deps.createClient()
  const linkResult = await runGuestGoogleLink(supabase.auth.linkIdentity.bind(supabase.auth), origin)
  if (linkResult.ok) {
    return linkResult
  }

  const manualLinkingDisabled =
    linkResult.error.toLowerCase().includes('manual linking is disabled') ||
    linkResult.error.toLowerCase().includes('identity linking disabled')

  if (!manualLinkingDisabled) {
    return linkResult
  }

  const tokenRes = await fetch('/api/guest-upgrade/token', { method: 'POST' })
  const tokenData = await tokenRes.json().catch(() => ({}))
  if (!tokenRes.ok || !tokenData.token) {
    return { ok: false, error: tokenData.error || 'Unable to start Google upgrade right now.' }
  }

  await signIn('google', {
    callbackUrl: `/api/guest-upgrade/complete?token=${encodeURIComponent(tokenData.token)}`,
  })
  return { ok: true }
}
