'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

async function ensureSession(): Promise<void> {
  // Check if we already have an active NextAuth session
  const res = await fetch('/api/auth/session')
  const session = await res.json()
  if (session?.user?.id) return

  // No session — sign in anonymously via the credentials provider
  const csrfRes = await fetch('/api/auth/csrf')
  const { csrfToken } = await csrfRes.json()

  await fetch('/api/auth/callback/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, json: 'true' }),
  })
}

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (pathname === '/onboarding' || pathname.startsWith('/api')) {
      setChecked(true)
      return
    }

    // Ensure a session exists first, then check onboarding state
    ensureSession()
      .then(() => Promise.all([
        fetch('/api/setup').then(r => r.json()),
        fetch('/api/memory?file=profile.md').then(r => r.json()),
      ]))
      .then(([setup, profile]) => {
        const ready =
          setup.hasApiKey &&
          profile.content &&
          profile.content.includes('**Name:**')
        if (!ready) {
          router.replace('/onboarding')
        } else {
          setChecked(true)
        }
      }).catch(() => setChecked(true))
  }, [pathname, router])

  if (!checked && pathname !== '/onboarding') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return <>{children}</>
}
