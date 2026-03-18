'use client'

import { isChatProvider, type ChatProvider } from '@/lib/chat-provider-config'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatModelOption } from './useChatTypes'

const CHAT_SELECTION_STORAGE_KEY = 'sifu-chat-selection-v1'

export type ChatSelection = {
  provider: ChatProvider
  model: string
}

export function readStoredSelection(): ChatSelection | null {
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

export function persistSelection(selection: ChatSelection): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHAT_SELECTION_STORAGE_KEY, JSON.stringify(selection))
  } catch {
    // Ignore storage write failures (private mode / quota).
  }
}

export function resolveSelection(
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

export function useChatSelection() {
  const [selectedProvider, setSelectedProvider] = useState<ChatProvider>('openrouter')
  const [selectedModel, setSelectedModel] = useState('')
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

  // Persist selection changes to localStorage.
  useEffect(() => {
    if (!selectedModel) return
    const selection = { provider: selectedProvider, model: selectedModel }
    storedSelectionRef.current = selection
    persistSelection(selection)
  }, [selectedProvider, selectedModel])

  return {
    selectedProvider,
    setSelectedProvider,
    selectedModel,
    setSelectedModel,
    storedSelectionRef,
    applySelection,
    getStoredSelection,
  }
}
