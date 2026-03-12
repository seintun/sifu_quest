'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      return
    }

    if (!('serviceWorker' in navigator)) {
      return
    }

    const registerWorker = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (error) {
        console.error('[pwa] service worker registration failed', error)
      }
    }

    void registerWorker()
  }, [])

  return null
}
