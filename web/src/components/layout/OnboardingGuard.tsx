'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type AccountStatusResponse = {
  onboarding?: {
    status?: 'not_started' | 'in_progress' | 'core_complete' | 'enriched_complete'
  }
}

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)
  const isBypassPath =
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname.startsWith('/api')

  useEffect(() => {
    if (isBypassPath) {
      return
    }

    fetch('/api/account/status')
      .then(async (response) => {
        if (response.status === 401) {
          throw new Error('unauthorized')
        }
        if (!response.ok) {
          throw new Error('status_failed')
        }
        return (await response.json()) as AccountStatusResponse
      })
      .then((data) => {
        const onboardingStatus = data.onboarding?.status
        const complete =
          onboardingStatus === 'core_complete' ||
          onboardingStatus === 'enriched_complete'
        if (!complete) {
          router.replace('/onboarding')
          return
        }
        setChecked(true)
      })
      .catch(() => {
        router.replace('/login')
      })
  }, [isBypassPath, router])

  if (isBypassPath) {
    return <>{children}</>
  }

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return <>{children}</>
}
