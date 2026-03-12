'use client'

import { consumeChatStream } from '@/lib/chat/stream-parser'
import { applyQuotaOnChatError } from '@/lib/chat-quota-ui'
import { buildSystemMeta, getSystemMessage, type ChatMessageMeta } from '@/lib/chat-system-messages'
import type { ChatProvider, ModelAvailability } from '@/lib/chat-provider-config'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface FreeQuota {
  isFreeTier: boolean
  remaining: number
  total: number
  isGuest?: boolean
}

export interface ChatMessage {
  id?: string
  createdAt?: string
  role: 'user' | 'assistant'
  content: string
  meta?: ChatMessageMeta
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
  recommendationRank?: number
  reason?: string
}

export interface SessionUsageMetrics {
  userTurns: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostMicrousd: number
}

export type StreamPhase = 'idle' | 'thinking' | 'typing'

type ChatSessionPaging = {
  hasOlder?: boolean
  nextBefore?: string | null
  nextBeforeId?: string | null
}

type ChatSessionResponse = {
  session?: { id: string } | null
  messages?: ChatMessage[]
  freeQuota?: FreeQuota | null
  selection?: { provider: ChatProvider; model: string }
  metrics?: SessionUsageMetrics
  paging?: ChatSessionPaging
}

const PAGE_SIZE = 40
const CHAT_SELECTION_STORAGE_KEY = 'sifu-chat-selection-v1'

type ChatSelection = {
  provider: ChatProvider
  model: string
}

function isChatProvider(value: unknown): value is ChatProvider {
  return value === 'openrouter' || value === 'anthropic'
}

function readStoredSelection(): ChatSelection | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(CHAT_SELECTION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { provider?: unknown; model?: unknown }
    if (!isChatProvider(parsed.provider) || typeof parsed.model !== 'string') return null
    return { provider: parsed.provider, model: parsed.model }
  } catch {
    return null
  }
}

function persistSelection(selection: ChatSelection): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHAT_SELECTION_STORAGE_KEY, JSON.stringify(selection))
  } catch {
    // Ignore storage write failures (private mode / quota).
  }
}

function resolveSelection(
  candidate: ChatSelection | null,
  modelsByProvider: Record<ChatProvider, ChatModelOption[]>,
): ChatSelection | null {
  if (!candidate) return null

  const models = modelsByProvider[candidate.provider] ?? []
  if (models.length === 0) return null

  const exact = models.find((model) => model.id === candidate.model && model.availability === 'available')
  if (exact) {
    return { provider: candidate.provider, model: exact.id }
  }

  const fallback = models.find((model) => model.availability === 'available') ?? models[0]
  if (!fallback) return null

  return { provider: candidate.provider, model: fallback.id }
}

function toMicrousdDisplay(microusd: number): string {
  return `$${(microusd / 1_000_000).toFixed(4)}`
}

function makeClientMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getMessageSignature(message: ChatMessage): string {
  return message.id
    ? `id:${message.id}`
    : `${message.role}|${message.createdAt ?? ''}|${message.content}`
}

function prependOlderMessages(current: ChatMessage[], older: ChatMessage[]): ChatMessage[] {
  if (older.length === 0) return current
  const seen = new Set(current.map(getMessageSignature))
  const nextOlder = older.filter((message) => {
    const signature = getMessageSignature(message)
    if (seen.has(signature)) return false
    seen.add(signature)
    return true
  })

  if (nextOlder.length === 0) return current
  return [...nextOlder, ...current]
}

export function useChat(mode: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
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
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false)
  const [streamPhase, setStreamPhase] = useState<StreamPhase>('idle')
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bootstrapAbortRef = useRef<AbortController | null>(null)
  const olderAbortRef = useRef<AbortController | null>(null)
  const storedSelectionRef = useRef<ChatSelection | null | undefined>(undefined)

  const applySelection = useCallback((provider: ChatProvider, model: string) => {
    setSelectedProvider(provider)
    setSelectedModel(model)
  }, [])

  const getStoredSelection = useCallback((): ChatSelection | null => {
    if (storedSelectionRef.current === undefined) {
      storedSelectionRef.current = readStoredSelection()
    }
    return storedSelectionRef.current
  }, [])

  const applyPaging = useCallback((paging: ChatSessionPaging | null | undefined) => {
    setHasOlderMessages(Boolean(paging?.hasOlder))
    setNextBefore(paging?.nextBefore ?? null)
    setNextBeforeId(paging?.nextBeforeId ?? null)
  }, [])

  const loadBootstrap = useCallback(async () => {
    bootstrapAbortRef.current?.abort()
    const controller = new AbortController()
    bootstrapAbortRef.current = controller

    setIsLoaded(false)
    setBootstrapError(null)

    try {
      const [providersRes, sessionRes] = await Promise.all([
        fetch('/api/chat/providers', { signal: controller.signal }),
        fetch(`/api/chat/session?mode=${mode}&limit=${PAGE_SIZE}`, { signal: controller.signal }),
      ])

      const providerData = await providersRes.json().catch(() => ({})) as {
        providers?: ChatProviderOption[]
        modelsByProvider?: Record<ChatProvider, ChatModelOption[]>
        defaults?: { provider: ChatProvider; model: string }
        account?: { hasAnthropicKey?: boolean }
      }
      const sessionData = await sessionRes.json().catch(() => ({})) as ChatSessionResponse & { error?: string; message?: string }

      if (!providersRes.ok) {
        throw new Error('Failed to load providers')
      }

      if (!sessionRes.ok) {
        throw new Error(sessionData.message || sessionData.error || 'Failed to load chat session')
      }

      if (bootstrapAbortRef.current !== controller) return

      setProviders(providerData.providers ?? [])
      const nextModelsByProvider = providerData.modelsByProvider ?? { openrouter: [], anthropic: [] }
      setModelsByProvider(nextModelsByProvider)
      setHasAnthropicKey(Boolean(providerData.account?.hasAnthropicKey))

      const sessionSelection = resolveSelection(sessionData.selection ?? null, nextModelsByProvider)
      const storedSelection = resolveSelection(getStoredSelection(), nextModelsByProvider)
      const defaultSelection = resolveSelection(providerData.defaults ?? null, nextModelsByProvider)
      const nextSelection = sessionSelection ?? storedSelection ?? defaultSelection
      if (nextSelection) {
        applySelection(nextSelection.provider, nextSelection.model)
      }

      if (sessionData.session) {
        setSessionId(sessionData.session.id)
        setMessages(sessionData.messages || [])
      } else {
        setSessionId(null)
        setMessages([])
      }

      setSessionMetrics(sessionData.metrics ?? null)
      setFreeQuota(sessionData.freeQuota ?? null)
      applyPaging(sessionData.paging)
    } catch (err) {
      if (bootstrapAbortRef.current !== controller || (err instanceof Error && err.name === 'AbortError')) return
      console.error('Failed to load chat bootstrap data', err)
      setBootstrapError('Unable to load chat right now. Please retry.')
    } finally {
      if (bootstrapAbortRef.current === controller) {
        setIsLoaded(true)
        bootstrapAbortRef.current = null
      }
    }
  }, [mode, applySelection, applyPaging, getStoredSelection])

  useEffect(() => {
    abortRef.current?.abort()
    bootstrapAbortRef.current?.abort()
    olderAbortRef.current?.abort()
    setIsStreaming(false)
    setSessionId(null)
    setUpgradeRequired(null)
    setMessages([])
    setFreeQuota(null)
    setSessionMetrics(null)
    setHasAnthropicKey(false)
    setStreamPhase('idle')
    setHasOlderMessages(false)
    setNextBefore(null)
    setNextBeforeId(null)
    setIsLoadingOlder(false)

    void loadBootstrap()

    return () => {
      abortRef.current?.abort()
      bootstrapAbortRef.current?.abort()
      olderAbortRef.current?.abort()
    }
  }, [mode, loadBootstrap])

  const reload = useCallback(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  const updateProviderSelection = useCallback((provider: ChatProvider) => {
    setUpgradeRequired(null)
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
    setUpgradeRequired(null)
    setSelectedModel(modelId)
  }, [])

  useEffect(() => {
    if (!selectedModel) return
    const selection = { provider: selectedProvider, model: selectedModel }
    storedSelectionRef.current = selection
    persistSelection(selection)
  }, [selectedProvider, selectedModel])

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
    const data = await res.json() as ChatSessionResponse & { error?: string; message?: string }
    if (res.ok && data.session) {
      setSessionId(data.session.id)
      if (data.freeQuota) {
        setFreeQuota(data.freeQuota)
      }
      if (data.selection) {
        applySelection(data.selection.provider, data.selection.model)
      }
      setSessionMetrics(data.metrics ?? null)
      applyPaging(data.paging)
      return data.session.id
    }
    throw new Error(data.message || data.error || 'Failed to create session')
  }, [sessionId, mode, selectedProvider, selectedModel, applySelection, applyPaging])

  const loadOlderMessages = useCallback(async () => {
    if ((!nextBeforeId && !nextBefore) || isLoadingOlder) return

    olderAbortRef.current?.abort()
    const controller = new AbortController()
    olderAbortRef.current = controller

    setIsLoadingOlder(true)
    try {
      const searchParams = new URLSearchParams({
        mode,
        limit: String(PAGE_SIZE),
      })
      if (nextBeforeId) {
        searchParams.set('beforeId', nextBeforeId)
      } else if (nextBefore) {
        searchParams.set('before', nextBefore)
      }

      const res = await fetch(`/api/chat/session?${searchParams.toString()}`, { signal: controller.signal })
      const data = await res.json().catch(() => ({})) as ChatSessionResponse
      if (olderAbortRef.current !== controller) return

      if (!res.ok) {
        return
      }

      const olderMessages = Array.isArray(data.messages) ? data.messages : []
      setMessages((prev) => prependOlderMessages(prev, olderMessages))
      applyPaging(data.paging)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
    } finally {
      if (olderAbortRef.current === controller) {
        olderAbortRef.current = null
        setIsLoadingOlder(false)
      }
    }
  }, [nextBefore, nextBeforeId, isLoadingOlder, mode, applyPaging])

  const processStreamResponse = useCallback(async (
    response: Response,
    initialMessages: ChatMessage[],
    onForbidden: (errorCode: string | null) => void,
  ): Promise<'completed' | 'forbidden' | 'failed'> => {
    if (!response.ok) {
      let errorMessage = 'Unknown error'
      let errorCode: string | null = null
      try {
        const errorData: { message?: string; error?: string } = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
        errorCode = errorData.error ?? null
      } catch {
        // Ignore malformed error payloads.
      }

      if (response.status === 403) {
        onForbidden(errorCode)
        return 'forbidden'
      }

      const assistantMessage: ChatMessage =
        response.status >= 500
          ? {
              role: 'assistant',
              content: getSystemMessage('chat_temporary_error'),
              meta: buildSystemMeta('chat_temporary_error'),
            }
          : {
              role: 'assistant',
              content: errorMessage,
            }

      setMessages([...initialMessages, assistantMessage])
      setIsStreaming(false)
      return 'failed'
    }

    const reader = response.body?.getReader()
    if (!reader) {
      setMessages([
        ...initialMessages,
        {
          role: 'assistant',
          content: getSystemMessage('chat_temporary_error'),
          meta: buildSystemMeta('chat_temporary_error'),
        },
      ])
      setIsStreaming(false)
      return 'failed'
    }

    let assistantContent = ''
    let usageApplied = false
    let flushTimeout: ReturnType<typeof setTimeout> | null = null
    let streamActive = true

    const flushAssistant = () => {
      if (!streamActive) return
      setMessages((prev) => {
        const updated = [...prev]
        if (updated.length === 0 || updated[updated.length - 1].role !== 'assistant') {
          updated.push({ id: makeClientMessageId('assistant'), role: 'assistant', content: assistantContent })
        } else {
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: assistantContent }
        }
        return updated
      })
    }

    const scheduleFlush = () => {
      if (flushTimeout) return
      flushTimeout = setTimeout(() => {
        flushTimeout = null
        flushAssistant()
      }, 40)
    }

    try {
      await consumeChatStream(reader, (parsed) => {
        if (parsed.text) {
          setStreamPhase('typing')
          assistantContent += parsed.text
          scheduleFlush()
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

        if (parsed.type === 'status' && parsed.status) {
          setStreamPhase(parsed.status)
        }

        if (parsed.error) {
          assistantContent += `\n\nError: ${parsed.error}`
          scheduleFlush()
        }
      })
    } catch (error) {
      streamActive = false
      throw error
    } finally {
      if (flushTimeout) {
        clearTimeout(flushTimeout)
        flushTimeout = null
      }
    }

    flushAssistant()
    streamActive = false

    if (!usageApplied) {
      setSessionMetrics((prev) => ({
        userTurns: (prev?.userTurns ?? 0) + 1,
        inputTokens: prev?.inputTokens ?? 0,
        outputTokens: prev?.outputTokens ?? 0,
        totalTokens: prev?.totalTokens ?? 0,
        estimatedCostMicrousd: prev?.estimatedCostMicrousd ?? 0,
      }))
    }
    return 'completed'
  }, [applySelection])

  const sendMessage = useCallback(async (userMessage: string) => {
    const optimisticUser: ChatMessage = {
      id: makeClientMessageId('user'),
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    }
    const newMessages: ChatMessage[] = [...messages, optimisticUser]

    setMessages(newMessages)
    setUpgradeRequired(null)
    setIsStreaming(true)
    setStreamPhase('thinking')

    const previousQuota = freeQuota
    const shouldEnforceQuota = Boolean(
      freeQuota?.isFreeTier &&
      !(selectedProvider === 'anthropic' && hasAnthropicKey),
    )

    if (shouldEnforceQuota) {
      setFreeQuota((prev) => prev && prev.isFreeTier ? { ...prev, remaining: Math.max(0, prev.remaining - 1) } : prev)
    }

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

      const streamResult = await processStreamResponse(res, newMessages, (errorCode) => {
        setFreeQuota(applyQuotaOnChatError(previousQuota, errorCode))
        const normalizedUpgradeCode =
          errorCode === 'invalid_api_key'
            ? 'provider_key_required'
            : (errorCode || 'missing_api_key')
        setUpgradeRequired(normalizedUpgradeCode)

        const isGuestBlocked = errorCode === 'guest_limit_reached' || errorCode === 'session_expired'
        const isProviderKeyRequired = errorCode === 'provider_key_required' || errorCode === 'invalid_api_key'

        const systemCode = isProviderKeyRequired
          ? (errorCode === 'invalid_api_key' ? 'invalid_provider_key' : 'provider_key_required')
          : isGuestBlocked
            ? 'guest_limit_reached'
            : 'free_tier_exhausted'

        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: getSystemMessage(systemCode),
            meta: buildSystemMeta(systemCode),
          },
        ])
        setIsStreaming(false)
      })

      if (streamResult === 'failed' && shouldEnforceQuota) {
        setFreeQuota(previousQuota)
      }
    } catch (err) {
      if (err instanceof Error) {
        setFreeQuota(previousQuota)
        if (err.name === 'AbortError') {
          return
        }
        setMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: getSystemMessage('chat_temporary_error'),
            meta: buildSystemMeta('chat_temporary_error'),
          },
        ])
      }
    } finally {
      if (abortRef.current === controller) {
        setIsStreaming(false)
        setStreamPhase('idle')
        abortRef.current = null
      }
    }
  }, [messages, mode, ensureSession, freeQuota, selectedProvider, selectedModel, hasAnthropicKey, processStreamResponse])

  const greet = useCallback(async () => {
    if (isStreaming) return
    setUpgradeRequired(null)
    setIsStreaming(true)
    setStreamPhase('thinking')

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

      await processStreamResponse(res, [], (errorCode) => {
        const normalizedUpgradeCode =
          errorCode === 'invalid_api_key'
            ? 'provider_key_required'
            : (errorCode || 'missing_api_key')
        setUpgradeRequired(normalizedUpgradeCode)
        setIsStreaming(false)
      })
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setMessages([
          {
            role: 'assistant',
            content: getSystemMessage('chat_temporary_error'),
            meta: buildSystemMeta('chat_temporary_error'),
          },
        ])
      }
    } finally {
      if (abortRef.current === controller) {
        setIsStreaming(false)
        setStreamPhase('idle')
        abortRef.current = null
      }
    }
  }, [isStreaming, mode, ensureSession, selectedProvider, selectedModel, processStreamResponse])

  const clearHistory = useCallback(async () => {
    setMessages([])
    setSessionId(null)
    setSessionMetrics(null)
    setHasOlderMessages(false)
    setNextBefore(null)
    setNextBeforeId(null)
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
        applyPaging(data.paging)
      }
    } catch (err) {
      console.error('Failed to clear history', err)
    }
  }, [mode, selectedProvider, selectedModel, applySelection, applyPaging])

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
    bootstrapError,
    reload,
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
    hasAnthropicKey,
    streamPhase,
    hasOlderMessages,
    isLoadingOlder,
    loadOlderMessages,
    updateProviderSelection,
    updateModelSelection,
    formatMicrousd: toMicrousdDisplay,
  }
}
