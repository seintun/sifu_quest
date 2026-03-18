'use client'

import { applyQuotaOnChatError } from '@/lib/chat-quota-ui'
import { buildSystemMeta, getSystemMessage } from '@/lib/chat-system-messages'
import { type ChatProvider } from '@/lib/chat-provider-config'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  resolveSelection,
  useChatSelection,
} from './chat/useChatSelection'
import {
  PAGE_SIZE,
  useChatPagination,
  type ChatSessionPaging,
} from './chat/useChatPagination'
import { useChatStreaming } from './chat/useChatStreaming'
import type {
  ChatMessage,
  ChatModelGroupOption,
  ChatModelOption,
  ChatProviderOption,
  FreeQuota,
  SessionUsageMetrics,
} from './chat/useChatTypes'

// Re-export types for backward compatibility.
export type {
  ChatMessage,
  ChatModelGroupOption,
  ChatModelOption,
  ChatProviderOption,
  FreeQuota,
  SessionUsageMetrics,
  StreamPhase,
} from './chat/useChatTypes'

type ChatSessionResponse = {
  session?: { id: string } | null
  messages?: ChatMessage[]
  freeQuota?: FreeQuota | null
  selection?: { provider: ChatProvider; model: string }
  metrics?: SessionUsageMetrics
  paging?: ChatSessionPaging
}

function toMicrousdDisplay(microusd: number): string {
  return `$${(microusd / 1_000_000).toFixed(4)}`
}

function makeClientMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useChat(mode: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState<string | null>(null)
  const [freeQuota, setFreeQuota] = useState<FreeQuota | null>(null)
  const [providers, setProviders] = useState<ChatProviderOption[]>([])
  const [modelsByProvider, setModelsByProvider] = useState<Record<ChatProvider, ChatModelOption[]>>({
    openrouter: [],
    anthropic: [],
  })
  const [modelGroupsByProvider, setModelGroupsByProvider] = useState<Record<ChatProvider, ChatModelGroupOption[]>>({
    openrouter: [],
    anthropic: [],
  })
  const [sessionMetrics, setSessionMetrics] = useState<SessionUsageMetrics | null>(null)
  const [hasProviderKey, setHasProviderKey] = useState<Record<ChatProvider, boolean>>({
    openrouter: false,
    anthropic: false,
  })
  const [isLoadingOpenRouterAllModels, setIsLoadingOpenRouterAllModels] = useState(false)

  const bootstrapAbortRef = useRef<AbortController | null>(null)
  const openRouterCatalogAbortRef = useRef<AbortController | null>(null)

  // Sub-hooks
  const {
    selectedProvider,
    setSelectedProvider,
    selectedModel,
    setSelectedModel,
    applySelection,
    getStoredSelection,
  } = useChatSelection()

  const {
    hasOlderMessages,
    isLoadingOlder,
    applyPaging,
    resetPaging,
    loadOlderMessages,
    abortOlder,
  } = useChatPagination()

  const {
    streamPhase,
    isStreaming,
    setIsStreaming,
    abortRef,
    processStreamResponse,
    startStreaming,
    stopStreaming,
    resetStreaming,
  } = useChatStreaming({
    onApplySelection: applySelection,
  })

  const loadBootstrap = useCallback(async () => {
    bootstrapAbortRef.current?.abort()
    const controller = new AbortController()
    bootstrapAbortRef.current = controller

    setIsLoaded(false)
    setBootstrapError(null)

    try {
      const [providersRes, sessionRes] = await Promise.all([
        fetch('/api/chat/providers', { signal: controller.signal }),
        fetch(`/api/chat/session?mode=${mode}&limit=${PAGE_SIZE}&create_if_missing=1`, { signal: controller.signal }),
      ])

      const providerData = await providersRes.json().catch(() => ({})) as {
        providers?: ChatProviderOption[]
        modelsByProvider?: Record<ChatProvider, ChatModelOption[]>
        modelGroupsByProvider?: Record<ChatProvider, ChatModelGroupOption[]>
        defaults?: { provider: ChatProvider; model: string }
        account?: { hasProviderKey?: Record<ChatProvider, boolean> }
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
      setModelGroupsByProvider(providerData.modelGroupsByProvider ?? { openrouter: [], anthropic: [] })
      setHasProviderKey({
        openrouter: Boolean(providerData.account?.hasProviderKey?.openrouter),
        anthropic: Boolean(providerData.account?.hasProviderKey?.anthropic),
      })

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
    abortOlder()
    openRouterCatalogAbortRef.current?.abort()
    setIsStreaming(false)
    setSessionId(null)
    setUpgradeRequired(null)
    setMessages([])
    setFreeQuota(null)
    setSessionMetrics(null)
    setHasProviderKey({ openrouter: false, anthropic: false })
    setModelGroupsByProvider({ openrouter: [], anthropic: [] })
    setIsLoadingOpenRouterAllModels(false)
    resetStreaming()
    resetPaging()

    void loadBootstrap()

    return () => {
      abortRef.current?.abort()
      bootstrapAbortRef.current?.abort()
      abortOlder()
      openRouterCatalogAbortRef.current?.abort()
    }
  }, [mode, loadBootstrap]) // eslint-disable-line react-hooks/exhaustive-deps -- stable setState helpers and refs intentionally omitted

  const reload = useCallback(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  const updateProviderSelection = useCallback((provider: ChatProvider) => {
    setUpgradeRequired(null)
    setSelectedProvider(provider)
    setSelectedModel((prev) => {
      const groupedModels = modelGroupsByProvider[provider] ?? []
      const allGroup = groupedModels.find((group) => group.id === 'all')
      const models = allGroup?.models ?? modelsByProvider[provider] ?? []
      if (models.some((model) => model.id === prev && model.availability === 'available')) {
        return prev
      }
      const firstAvailable = models.find((model) => model.availability === 'available')
      return firstAvailable?.id ?? models[0]?.id ?? ''
    })
  }, [modelGroupsByProvider, modelsByProvider]) // eslint-disable-line react-hooks/exhaustive-deps -- setSelectedProvider/setSelectedModel are stable state setters

  const loadAllOpenRouterModels = useCallback(async () => {
    if (isLoadingOpenRouterAllModels || !hasProviderKey.openrouter) return
    openRouterCatalogAbortRef.current?.abort()
    const controller = new AbortController()
    openRouterCatalogAbortRef.current = controller
    setIsLoadingOpenRouterAllModels(true)
    try {
      const res = await fetch('/api/chat/providers?openrouterAll=1', { signal: controller.signal })
      const data = await res.json().catch(() => ({})) as {
        modelsByProvider?: Record<ChatProvider, ChatModelOption[]>
        modelGroupsByProvider?: Record<ChatProvider, ChatModelGroupOption[]>
      }
      if (openRouterCatalogAbortRef.current !== controller) return
      if (!res.ok) {
        console.error('Failed to load full OpenRouter model catalog', data)
        setBootstrapError('Unable to load full OpenRouter catalog right now. Please retry.')
        return
      }
      if (data.modelsByProvider) {
        setModelsByProvider(data.modelsByProvider)
      }
      if (data.modelGroupsByProvider) {
        setModelGroupsByProvider(data.modelGroupsByProvider)
      }
      setBootstrapError(null)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      console.error('Failed to load full OpenRouter model catalog', error)
      setBootstrapError('Unable to load full OpenRouter catalog right now. Please retry.')
    } finally {
      if (openRouterCatalogAbortRef.current === controller) {
        openRouterCatalogAbortRef.current = null
        setIsLoadingOpenRouterAllModels(false)
      }
    }
  }, [isLoadingOpenRouterAllModels, hasProviderKey.openrouter])

  const updateModelSelection = useCallback((modelId: string) => {
    setUpgradeRequired(null)
    setSelectedModel(modelId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- setSelectedModel is a stable state setter

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

  const handleLoadOlderMessages = useCallback(async () => {
    await loadOlderMessages(mode, setMessages)
  }, [loadOlderMessages, mode])

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
    startStreaming()

    const previousQuota = freeQuota
    const shouldEnforceQuota = Boolean(
      freeQuota?.isFreeTier &&
      !hasProviderKey[selectedProvider],
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
      }, setMessages, setSessionMetrics)

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
        resetStreaming()
        abortRef.current = null
      }
    }
  }, [messages, mode, ensureSession, freeQuota, selectedProvider, selectedModel, hasProviderKey, processStreamResponse, startStreaming, setIsStreaming, resetStreaming]) // eslint-disable-line react-hooks/exhaustive-deps -- abortRef is a stable ref

  const greet = useCallback(async () => {
    if (isStreaming) return
    setUpgradeRequired(null)
    startStreaming()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Use existing sessionId from bootstrap (auto-created), or fallback to ensureSession
      const activeSessionId = sessionId ?? await ensureSession()

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
      }, setMessages, setSessionMetrics)
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
        resetStreaming()
        abortRef.current = null
      }
    }
  }, [isStreaming, mode, sessionId, ensureSession, selectedProvider, selectedModel, processStreamResponse, startStreaming, setIsStreaming, resetStreaming]) // eslint-disable-line react-hooks/exhaustive-deps -- abortRef is a stable ref

  const clearHistory = useCallback(async () => {
    setMessages([])
    setSessionId(null)
    setSessionMetrics(null)
    resetPaging()
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
  }, [mode, selectedProvider, selectedModel, applySelection, applyPaging, resetPaging])

  const selectedProviderInfo = providers.find((provider) => provider.id === selectedProvider) ?? null
  const selectedProviderGroups = modelGroupsByProvider[selectedProvider] ?? []
  const availableModelsForSelectedProvider = selectedProviderGroups.find((group) => group.id === 'all')?.models
    ?? modelsByProvider[selectedProvider]
    ?? []

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
    modelGroupsByProvider,
    selectedProvider,
    selectedModel,
    selectedProviderInfo,
    availableModelsForSelectedProvider,
    sessionMetrics,
    hasProviderKey,
    hasAnthropicKey: hasProviderKey.anthropic,
    hasOpenRouterKey: hasProviderKey.openrouter,
    streamPhase,
    hasOlderMessages,
    isLoadingOlder,
    isLoadingOpenRouterAllModels,
    loadAllOpenRouterModels,
    loadOlderMessages: handleLoadOlderMessages,
    updateProviderSelection,
    updateModelSelection,
    formatMicrousd: toMicrousdDisplay,
    sessionId,
  }
}
