'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface FreeQuota {
  isFreeTier: boolean
  remaining: number
  total: number
  isGuest?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const FREE_TIER_EXHAUSTED_MESSAGE =
  'You have exhausted your free messages. To continue your mastery journey, please navigate to **Settings** and provide your own Anthropic API key. Your key is encrypted with AES-256-CBC before storage, and your past conversation remains accessible here.'

const GUEST_LIMIT_REACHED_MESSAGE =
  'You have reached the guest limit. Please sign up to continue. After creating your account, add your own Anthropic API key in **Settings** to keep chatting securely.'

const CHAT_TEMPORARY_ERROR_MESSAGE =
  'I hit a temporary issue loading your workspace. Please try again in a moment.'

export function useChat(mode: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [upgradeRequired, setUpgradeRequired] = useState<string | null>(null)
  const [freeQuota, setFreeQuota] = useState<FreeQuota | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load history for the current mode from DB
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    setIsLoaded(false)
    abortRef.current?.abort()
    setIsStreaming(false)
    setSessionId(null)
    setUpgradeRequired(null)
    setMessages([])
    setFreeQuota(null)
    
    fetch(`/api/chat/session?mode=${mode}`, { signal: controller.signal })
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error((data as { error?: string }).error || 'Failed to load chat session')
        }
        return data
      })
      .then(data => {
        if (cancelled) return
        if (data.session) {
           setSessionId(data.session.id)
           setMessages(data.messages || [])
        }
        setFreeQuota(data.freeQuota ?? null)
        setIsLoaded(true)
      })
      .catch(err => {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return
        console.error("Failed to load chat session", err)
        setIsLoaded(true)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [mode])

  // Helper to ensure we have an active DB session before sending a message
  const ensureSession = useCallback(async (): Promise<string> => {
     if (sessionId) return sessionId
     const res = await fetch('/api/chat/session', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ mode })
     })
      const data = await res.json()
      if (res.ok && data.session) {
        setSessionId(data.session.id)
        if (data.freeQuota) {
          setFreeQuota(data.freeQuota)
        }
        return data.session.id
      }
     throw new Error(data.error || 'Failed to create session')
  }, [sessionId, mode])

  const sendMessage = useCallback(async (userMessage: string) => {
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ]
    setMessages(newMessages)
    setIsStreaming(true)

    const previousQuota = freeQuota

    // Optimistically decrement quota
    setFreeQuota(prev => prev && prev.isFreeTier ? { ...prev, remaining: Math.max(0, prev.remaining - 1) } : prev)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const activeSessionId = await ensureSession()
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages, 
          mode,
          sessionId: activeSessionId
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setFreeQuota(previousQuota)
        let errorMessage = 'Unknown error'
        let errorCode: string | null = null
        try {
           const errorData: { message?: string; error?: string } = await res.json()
           errorMessage = errorData.message || errorData.error || errorMessage
           errorCode = errorData.error ?? null
        } catch { /* ignore */ }
        
        if (res.status === 403) {
          setUpgradeRequired(errorCode || 'missing_api_key')
          const isGuestBlocked = errorCode === 'guest_limit_reached' || errorCode === 'session_expired'
          setMessages([
            ...newMessages,
            {
              role: 'assistant',
              content: isGuestBlocked ? GUEST_LIMIT_REACHED_MESSAGE : FREE_TIER_EXHAUSTED_MESSAGE,
            },
          ])
          setIsStreaming(false)
          return
        }

        const safeMessage = res.status >= 500 ? CHAT_TEMPORARY_ERROR_MESSAGE : errorMessage
        setMessages([...newMessages, { role: 'assistant', content: safeMessage }])
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setFreeQuota(previousQuota)
        setIsStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let assistantContent = ''
      setMessages([...newMessages, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              assistantContent += parsed.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                return updated
              })
            }
            if (parsed.error) {
              assistantContent += `\n\nError: ${parsed.error}`
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                return updated
              })
            }
          } catch { /* skip malformed JSON */ }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setFreeQuota(previousQuota)
        if (err.name === 'AbortError') {
          return
        }
        setMessages([...newMessages, { role: 'assistant', content: CHAT_TEMPORARY_ERROR_MESSAGE }])
      }
    } finally {
      if (abortRef.current === controller) {
        setIsStreaming(false)
        abortRef.current = null
      }
    }
  }, [messages, mode, ensureSession, freeQuota])

  const greet = useCallback(async () => {
    if (isStreaming) return
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const activeSessionId = await ensureSession()
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [{ role: 'user', content: 'Start the session.' }], 
          mode, 
          isGreeting: true,
          sessionId: activeSessionId
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        let errorMessage = 'Unknown error'
        let errorCode: string | null = null
        try {
           const errorData: { message?: string; error?: string } = await res.json()
           errorMessage = errorData.message || errorData.error || errorMessage
           errorCode = errorData.error ?? null
        } catch { /* ignore */ }
        
        if (res.status === 403) {
          setUpgradeRequired(errorCode || 'missing_api_key')
          setIsStreaming(false)
          return
        }

        const safeMessage = res.status >= 500 ? CHAT_TEMPORARY_ERROR_MESSAGE : errorMessage
        setMessages([{ role: 'assistant', content: safeMessage }])
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setIsStreaming(false); return }

      const decoder = new TextDecoder()
      let assistantContent = ''
      setMessages([{ role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              assistantContent += parsed.text
              setMessages([{ role: 'assistant', content: assistantContent }])
            }
            if (parsed.error) {
              assistantContent += `\n\nError: ${parsed.error}`
              setMessages([{ role: 'assistant', content: assistantContent }])
            }
          } catch { /* skip malformed JSON */ }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages([{ role: 'assistant', content: CHAT_TEMPORARY_ERROR_MESSAGE }])
      }
    } finally {
      if (abortRef.current === controller) {
        setIsStreaming(false)
        abortRef.current = null
      }
    }
  }, [isStreaming, mode, ensureSession])

  const clearHistory = useCallback(async () => {
    setMessages([])
    setSessionId(null)
    // Archive the active session by creating a new one (creating a new one automatically archives old ones for that mode)
    try {
      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      })
      const data = await res.json()
      if (res.ok && data.session) {
        setSessionId(data.session.id)
        if (data.freeQuota) {
          setFreeQuota(data.freeQuota)
        }
      }
    } catch (err) {
      console.error("Failed to clear history", err)
    }
  }, [mode])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { messages, setMessages, isStreaming, isLoaded, upgradeRequired, freeQuota, sendMessage, greet, clearHistory, stopStreaming }
}
