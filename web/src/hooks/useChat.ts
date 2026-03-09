'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_PREFIX = 'thinking-buddy-chat-'

export function useChat(mode: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${mode}`)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Persist to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_PREFIX}${mode}`, JSON.stringify(messages))
    }
  }, [messages, mode])

  // Reload messages when mode changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    abortRef.current?.abort()
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${mode}`)
      setMessages(stored ? JSON.parse(stored) : [])
    } catch {
      setMessages([])
    }
  }, [mode])

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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, mode }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const error = await res.json()
        setMessages([...newMessages, { role: 'assistant', content: `Error: ${error.error || 'Unknown error'}` }])
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setIsStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let assistantContent = ''

      // Add placeholder assistant message
      setMessages([...newMessages, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
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
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages([...newMessages, { role: 'assistant', content: `Error: ${err.message}` }])
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [messages, mode])

  const greet = useCallback(async () => {
    if (isStreaming) return
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    const greetMessages = [{ role: 'user', content: 'Start the session.' }]

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: greetMessages, mode, isGreeting: true }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const error = await res.json()
        setMessages([{ role: 'assistant', content: `Error: ${error.error || 'Unknown error'}` }])
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setIsStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages([{ role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
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
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages([{ role: 'assistant', content: `Error: ${err.message}` }])
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [isStreaming, mode])

  const clearHistory = useCallback(() => {
    setMessages([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${STORAGE_PREFIX}${mode}`)
    }
  }, [mode])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { messages, isStreaming, sendMessage, greet, clearHistory, stopStreaming }
}
