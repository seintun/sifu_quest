'use client'

import { WifiOff } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export function OfflineBanner() {
  const { isOffline } = useNetworkStatus()

  if (!isOffline) {
    return null
  }

  return (
    <div
      data-testid="offline-banner"
      role="status"
      aria-live="polite"
      className="fixed left-3 right-3 z-50 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning backdrop-blur md:left-auto md:right-4 md:max-w-sm md:bottom-4"
    >
      <div className="flex items-center gap-2">
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>
          You are offline. Cached pages remain available, but live actions need an internet connection.
        </p>
      </div>
    </div>
  )
}
