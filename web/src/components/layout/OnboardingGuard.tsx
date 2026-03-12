'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { WifiOff } from 'lucide-react'

type AccountStatusResponse = {
  onboarding?: {
    status?: 'not_started' | 'in_progress' | 'core_complete' | 'enriched_complete'
  }
}

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isBypassPath =
    pathname === '/login' ||
    pathname === '/onboarding' ||
    pathname.startsWith('/api')

  const [checked, setChecked] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [checkAttempt, setCheckAttempt] = useState(0)

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
        } else {
          setIsOffline(false)
          setChecked(true)
        }
      })
      .catch((error) => {
        if (!navigator.onLine || error instanceof TypeError) {
          setIsOffline(true)
          return
        }
        router.replace('/login')
      })
  }, [checkAttempt, isBypassPath, router])

  useEffect(() => {
    if (isBypassPath || !isOffline) {
      return
    }

    const onOnline = () => {
      setIsOffline(false)
      setCheckAttempt((prev) => prev + 1)
    }

    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [isBypassPath, isOffline])

  if (!isBypassPath && isOffline) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-warning/40 bg-warning/5 p-5 text-sm">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-warning/45 bg-warning/10 px-2.5 py-1 text-xs text-warning">
            <WifiOff className="h-3.5 w-3.5" />
            Offline
          </p>
          <h2 className="mb-2 text-base font-semibold text-foreground">Connection required to verify your session</h2>
          <p className="mb-4 text-muted-foreground">
            The app shell is available, but onboarding/account checks need internet access.
          </p>
          <Button
            type="button"
            onClick={() => {
              setIsOffline(false)
              setCheckAttempt((prev) => prev + 1)
            }}
            className="w-full"
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (!isBypassPath && !checked) {
    return <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center"><div className="h-8 w-8 animate-pulse rounded-full bg-muted" /></div>
  }

  return <>{children}</>
}
