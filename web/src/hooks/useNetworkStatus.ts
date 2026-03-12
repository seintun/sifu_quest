'use client'

import { useEffect, useState } from 'react'

export function useNetworkStatus() {
  // Keep SSR and first client render identical to avoid hydration drift.
  const [isOnline, setIsOnline] = useState<boolean>(true)

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  return { isOnline, isOffline: !isOnline }
}
