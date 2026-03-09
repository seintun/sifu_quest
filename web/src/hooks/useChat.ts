'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function useChat(mode: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Load history for the current mode from DB
  useEffect(() => {
    setIsLoaded(false)
    abortRef.current?.abort()
    setIsStreaming(false)
    setSessionId(null)
    setUpgradeRequired(false)
    setMessages([])
    
    fetch(`/api/chat/session?mode=${mode}`)
      .then(res => res.json())
      .then(data => {
        if (data.session) {
           setSessionId(data.session.id)
           setMessages(data.messages || [])
        }
        setIsLoaded(true)
      })
      .catch(err => {
        console.error("Failed to load chat session", err)
        setIsLoaded(true)
      })
  }, [mode])

  // Helper to ensure we have an active DB session before sending a message
  const ensureSession = async (): Promise<string> => {
     if (sessionId) return sessionId
     const res = await fetch('/api/chat/session', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ mode })
     })
     const data = await res.json()
     if (res.ok && data.session) {
       setSessionId(data.session.id)
       return data.session.id
     }
     throw new Error(data.error || 'Failed to create session')
  }

  const sendMessage = useCallback(async (userMessage: string) => {
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ]
    setMessages(newMessages)
    setIsStreaming(true)

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
        if (res.status === 403) {
          setUpgradeRequired(true)
        }
        let errorMessage = 'Unknown error'
        try {
           const errorData = await res.json()
           errorMessage = errorData.message || errorData.error || errorMessage
        } catch { /* ignore */ }
        
        setMessages([...newMessages, { role: 'assistant', content: `Error: ${errorMessage}` }])
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setIsStreaming(false); return }

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
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages([...newMessages, { role: 'assistant', content: `Error: ${err.message}` }])
      }
    } finally {
      if (abortRef.current === controller) {
        setIsStreaming(false)
        abortRef.current = null
      }
    }
  }, [messages, mode, sessionId])

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
        if (res.status === 403) {
          setUpgradeRequired(true)
        }
        let errorMessage = 'Unknown error'
        try {
           const errorData = await res.json()
           errorMessage = errorData.message || errorData.error || errorMessage
        } catch { /* ignore */ }
        
        setMessages([{ role: 'assistant', content: `Error: ${errorMessage}` }])
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
        setMessages([{ role: 'assistant', content: `Error: ${err.message}` }])
      }
    } finally {
      if (abortRef.current === controller) {
        setIsStreaming(false)
        abortRef.current = null
      }
    }
  }, [isStreaming, mode, sessionId])

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
      }
    } catch (err) {
      console.error("Failed to clear history", err)
    }
  }, [mode])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { messages, isStreaming, isLoaded, upgradeRequired, sendMessage, greet, clearHistory, stopStreaming }
}
