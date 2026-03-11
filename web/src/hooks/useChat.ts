'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatProvider, ModelAvailability } from '@/lib/chat-provider-config'

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

export interface ChatProviderOption {
  id: ChatProvider
  label: string
  availability: ModelAvailability
  reason?: string
}

export interface ChatModelOption {
  id: string
  label: string
  provider: ChatProvider
  isFree: boolean
  availability: ModelAvailability
  reason?: string
}

export interface SessionUsageMetrics {
  userTurns: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostMicrousd: number
}

const FREE_TIER_EXHAUSTED_MESSAGE =
  'You have exhausted your free messages. To continue your mastery journey, please navigate to **Settings** and provide your own Anthropic API key. Your key is encrypted with AES-256-CBC before storage, and your past conversation remains accessible here.'

const GUEST_LIMIT_REACHED_MESSAGE =
  'You have reached the guest limit. Please sign up to continue. After creating your account, add your own Anthropic API key in **Settings** to keep chatting securely.'

const PROVIDER_KEY_REQUIRED_MESSAGE =
  'Anthropic models require your own Anthropic API key. Add your key in **Settings** and try again.'

const CHAT_TEMPORARY_ERROR_MESSAGE =
  'I hit a temporary issue loading your workspace. Please try again in a moment.'

type ChatSessionResponse = {
  session?: { id: string } | null
  messages?: ChatMessage[]
  freeQuota?: FreeQuota | null
  selection?: { provider: ChatProvider; model: string }
  metrics?: SessionUsageMetrics
}

function toMicrousdDisplay(microusd: number): string {
  return `$${(microusd / 1_000_000).toFixed(4)}`
}

export function useChat(mode: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [upgradeRequired, setUpgradeRequired] = useState<string | null>(null)
  const [freeQuota, setFreeQuota] = useState<FreeQuota | null>(null)
  const [providers, setProviders] = useState<ChatProviderOption[]>([])
  const [modelsByProvider, setModelsByProvider] = useState<Record<ChatProvider, ChatModelOption[]>>({
    openrouter: [],
    anthropic: [],
  })
  const [selectedProvider, setSelectedProvider] = useState<ChatProvider>('openrouter')
  const [selectedModel, setSelectedModel] = useState('')
  const [sessionMetrics, setSessionMetrics] = useState<SessionUsageMetrics | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const applySelection = useCallback((provider: ChatProvider, model: string) => {
    setSelectedProvider(provider)
    setSelectedModel(model)
  }, [])

  // Load provider catalog + history for the current mode from DB.
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
    setSessionMetrics(null)

    const load = async () => {
      try {
        const providersRes = await fetch('/api/chat/providers', { signal: controller.signal })
        const providerData = await providersRes.json().catch(() => ({})) as {
          providers?: ChatProviderOption[]
          modelsByProvider?: Record<ChatProvider, ChatModelOption[]>
          defaults?: { provider: ChatProvider; model: string }
        }

        if (!providersRes.ok) {
          throw new Error('Failed to load providers')
        }

        if (cancelled) return

        setProviders(providerData.providers ?? [])
        setModelsByProvider(providerData.modelsByProvider ?? { openrouter: [], anthropic: [] })

        if (providerData.defaults) {
          applySelection(providerData.defaults.provider, providerData.defaults.model)
        }

        const sessionRes = await fetch(`/api/chat/session?mode=${mode}`, { signal: controller.signal })
        const sessionData = await sessionRes.json().catch(() => ({})) as ChatSessionResponse & { error?: string }

        if (!sessionRes.ok) {
          throw new Error(sessionData.error || 'Failed to load chat session')
        }

        if (cancelled) return

        if (sessionData.session) {
          setSessionId(sessionData.session.id)
          setMessages(sessionData.messages || [])
        }

        if (sessionData.selection) {
          applySelection(sessionData.selection.provider, sessionData.selection.model)
        }

        setSessionMetrics(sessionData.metrics ?? null)
        setFreeQuota(sessionData.freeQuota ?? null)
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) return
        console.error('Failed to load chat bootstrap data', err)
      } finally {
        if (!cancelled) {
          setIsLoaded(true)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [mode, applySelection])

  const updateProviderSelection = useCallback((provider: ChatProvider) => {
    setSelectedProvider(provider)
    setSelectedModel((prev) => {
      const models = modelsByProvider[provider] ?? []
      if (models.some((model) => model.id === prev && model.availability === 'available')) {
        return prev
      }
      const firstAvailable = models.find((model) => model.availability === 'available')
      return firstAvailable?.id ?? models[0]?.id ?? ''
    })
  }, [modelsByProvider])

  const updateModelSelection = useCallback((modelId: string) => {
    setSelectedModel(modelId)
  }, [])

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId
    const res = await fetch('/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        provider: selectedProvider,
        model: selectedModel,
      }),
    })
    const data = await res.json() as ChatSessionResponse & { error?: string }
    if (res.ok && data.session) {
      setSessionId(data.session.id)
      if (data.freeQuota) {
        setFreeQuota(data.freeQuota)
      }
      if (data.selection) {
        applySelection(data.selection.provider, data.selection.model)
      }
      setSessionMetrics(data.metrics ?? null)
      return data.session.id
    }
    throw new Error(data.error || 'Failed to create session')
  }, [sessionId, mode, selectedProvider, selectedModel, applySelection])

  const sendMessage = useCallback(async (userMessage: string) => {
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ]
    setMessages(newMessages)
    setIsStreaming(true)

    const previousQuota = freeQuota

    // Optimistically decrement quota.
    setFreeQuota((prev) => prev && prev.isFreeTier ? { ...prev, remaining: Math.max(0, prev.remaining - 1) } : prev)

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
          sessionId: activeSessionId,
          provider: selectedProvider,
          model: selectedModel,
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
        } catch {
          // Ignore malformed error payloads.
        }

        if (res.status === 403) {
          setUpgradeRequired(errorCode || 'missing_api_key')
          const isGuestBlocked = errorCode === 'guest_limit_reached' || errorCode === 'session_expired'
          const isProviderKeyRequired = errorCode === 'provider_key_required'
          setMessages([
            ...newMessages,
            {
              role: 'assistant',
              content: isProviderKeyRequired
                ? PROVIDER_KEY_REQUIRED_MESSAGE
                : isGuestBlocked
                  ? GUEST_LIMIT_REACHED_MESSAGE
                  : FREE_TIER_EXHAUSTED_MESSAGE,
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
      let usageApplied = false
      setMessages([...newMessages, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as {
              text?: string
              error?: string
              type?: string
              provider?: ChatProvider
              model?: string
              inputTokens?: number | null
              outputTokens?: number | null
              totalTokens?: number | null
              estimatedCostMicrousd?: number | null
            }

            if (parsed.text) {
              assistantContent += parsed.text
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                return updated
              })
            }

            if (parsed.type === 'usage') {
              usageApplied = true
              if (parsed.provider && parsed.model) {
                applySelection(parsed.provider, parsed.model)
              }
              setSessionMetrics((prev) => ({
                userTurns: (prev?.userTurns ?? 0) + 1,
                inputTokens: (prev?.inputTokens ?? 0) + (parsed.inputTokens ?? 0),
                outputTokens: (prev?.outputTokens ?? 0) + (parsed.outputTokens ?? 0),
                totalTokens: (prev?.totalTokens ?? 0) + (parsed.totalTokens ?? 0),
                estimatedCostMicrousd: (prev?.estimatedCostMicrousd ?? 0) + (parsed.estimatedCostMicrousd ?? 0),
              }))
            }

            if (parsed.error) {
              assistantContent += `\n\nError: ${parsed.error}`
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                return updated
              })
            }
          } catch {
            // Skip malformed JSON lines.
          }
        }
      }

      if (!usageApplied) {
        setSessionMetrics((prev) => ({
          userTurns: (prev?.userTurns ?? 0) + 1,
          inputTokens: prev?.inputTokens ?? 0,
          outputTokens: prev?.outputTokens ?? 0,
          totalTokens: prev?.totalTokens ?? 0,
          estimatedCostMicrousd: prev?.estimatedCostMicrousd ?? 0,
        }))
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
  }, [messages, mode, ensureSession, freeQuota, selectedProvider, selectedModel, applySelection])

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
          sessionId: activeSessionId,
          provider: selectedProvider,
          model: selectedModel,
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
        } catch {
          // Ignore malformed error payloads.
        }

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
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data) as { text?: string; type?: string; provider?: ChatProvider; model?: string }
            if (parsed.text) {
              assistantContent += parsed.text
              setMessages([{ role: 'assistant', content: assistantContent }])
            }
            if (parsed.type === 'usage') {
              if (parsed.provider && parsed.model) {
                applySelection(parsed.provider, parsed.model)
              }
              setSessionMetrics((prev) => ({
                userTurns: (prev?.userTurns ?? 0) + 1,
                inputTokens: prev?.inputTokens ?? 0,
                outputTokens: prev?.outputTokens ?? 0,
                totalTokens: prev?.totalTokens ?? 0,
                estimatedCostMicrousd: prev?.estimatedCostMicrousd ?? 0,
              }))
            }
          } catch {
            // Ignore malformed JSON payloads.
          }
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
  }, [isStreaming, mode, ensureSession, selectedProvider, selectedModel, applySelection])

  const clearHistory = useCallback(async () => {
    setMessages([])
    setSessionId(null)
    setSessionMetrics(null)
    try {
      const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          provider: selectedProvider,
          model: selectedModel,
        }),
      })
      const data = await res.json() as ChatSessionResponse
      if (res.ok && data.session) {
        setSessionId(data.session.id)
        if (data.freeQuota) {
          setFreeQuota(data.freeQuota)
        }
        if (data.selection) {
          applySelection(data.selection.provider, data.selection.model)
        }
        setSessionMetrics(data.metrics ?? null)
      }
    } catch (err) {
      console.error('Failed to clear history', err)
    }
  }, [mode, selectedProvider, selectedModel, applySelection])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const selectedProviderInfo = providers.find((provider) => provider.id === selectedProvider) ?? null
  const availableModelsForSelectedProvider = modelsByProvider[selectedProvider] ?? []

  return {
    messages,
    setMessages,
    isStreaming,
    isLoaded,
    upgradeRequired,
    freeQuota,
    sendMessage,
    greet,
    clearHistory,
    stopStreaming,
    providers,
    modelsByProvider,
    selectedProvider,
    selectedModel,
    selectedProviderInfo,
    availableModelsForSelectedProvider,
    sessionMetrics,
    updateProviderSelection,
    updateModelSelection,
    formatMicrousd: toMicrousdDisplay,
  }
}
