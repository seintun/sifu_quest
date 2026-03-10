'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

async function hasSession(): Promise<boolean> {
  const res = await fetch('/api/auth/session')
  const session = await res.json()
  return !!session?.user?.id
}

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (pathname === '/login' || pathname === '/onboarding' || pathname.startsWith('/api')) {
      setChecked(true)
      return
    }

    // Check for session first
    hasSession()
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
      }).catch(() => {
        // If session check fails or API fails, redirect to login
        router.replace('/login')
      })
  }, [pathname, router])

  if (!checked && pathname !== '/onboarding' && pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return <>{children}</>
}
