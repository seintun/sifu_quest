'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Skip check for onboarding page and API routes
    if (pathname === '/onboarding' || pathname.startsWith('/api')) {
      setChecked(true)
      return
    }

    fetch('/api/memory?file=profile.md')
      .then(res => res.json())
      .then(data => {
        if (!data.content || !data.content.includes('**Name:**')) {
          router.replace('/onboarding')
        } else {
          setChecked(true)
        }
      })
      .catch(() => setChecked(true))
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
