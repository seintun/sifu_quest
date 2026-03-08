'use client'

import { useState, useEffect, useCallback } from 'react'

export function useMemoryFile(filename: string) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    fetch(`/api/memory?file=${encodeURIComponent(filename)}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setContent(data.content || '')
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [filename])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { content, loading, error, refetch }
}

export function useProgress() {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(() => {
    setLoading(true)
    fetch('/api/progress')
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { metrics, loading, refetch }
}
