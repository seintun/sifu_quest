import { signOut } from 'next-auth/react'
import { createClientBrowser } from './supabase-browser'

/**
 * Cleanly tears down both the Supabase session and the next-auth session.
 * Always call Supabase first so the cookie is cleared before next-auth redirect.
 */
export async function performSignOut(): Promise<void> {
  try {
    const supabase = createClientBrowser()
    await supabase.auth.signOut()
  } catch {
    // Non-fatal — proceed with next-auth sign-out regardless
  }
  await signOut({ callbackUrl: '/login' })
}
