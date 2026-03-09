'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { saveMessages, loadMessages, removeMessages, type ChatMessage } from '@/lib/chat-storage'

export type { ChatMessage }

const STORAGE_PREFIX = 'thinking-buddy-chat-'

export function useChat(mode: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // Track which mode's data is currently loaded to guard premature saves
  const loadedModeRef = useRef<string | null>(null)

  // Decrypt and load history for the current mode
  useEffect(() => {
    setIsLoaded(false)
    abortRef.current?.abort()
    setIsStreaming(false)
    loadMessages(`${STORAGE_PREFIX}${mode}`).then(msgs => {
      setMessages(msgs)
      loadedModeRef.current = mode
      setIsLoaded(true)
    })
  }, [mode])

  // Encrypt and persist — only after load for this mode completes to avoid
  // cross-mode overwrites during the async load transition
  useEffect(() => {
    if (loadedModeRef.current !== mode) return
    saveMessages(`${STORAGE_PREFIX}${mode}`, messages)
  }, [messages, mode])

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
  }, [messages, mode])

  const greet = useCallback(async () => {
    if (isStreaming) return
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Start the session.' }], mode, isGreeting: true }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const error = await res.json()
        setMessages([{ role: 'assistant', content: `Error: ${error.error || 'Unknown error'}` }])
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
  }, [isStreaming, mode])

  const clearHistory = useCallback(() => {
    setMessages([])
    removeMessages(`${STORAGE_PREFIX}${mode}`)
  }, [mode])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { messages, isStreaming, isLoaded, sendMessage, greet, clearHistory, stopStreaming }
}
