'use client'

import { useEffect, useState } from 'react'

function getInitialOnlineState(): boolean {
  if (typeof navigator === 'undefined') {
    return true
  }
  return navigator.onLine
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(getInitialOnlineState)

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
