'use client'

import type { ChatProvider, ModelAvailability } from '@/lib/chat-provider-config'
import type { ChatMessageMeta } from '@/lib/chat-system-messages'

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

export interface ChatModelGroupOption {
  id: string
  label: string
  models: ChatModelOption[]
  hasMore?: boolean
}

export interface SessionUsageMetrics {
  userTurns: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostMicrousd: number
}

export type StreamPhase = 'idle' | 'thinking' | 'typing'
