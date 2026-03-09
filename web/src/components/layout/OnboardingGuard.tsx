'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (pathname === '/onboarding' || pathname.startsWith('/api')) {
      setChecked(true)
      return
    }

    Promise.all([
      fetch('/api/setup').then(r => r.json()),
      fetch('/api/memory?file=profile.md').then(r => r.json()),
    ]).then(([setup, profile]) => {
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
