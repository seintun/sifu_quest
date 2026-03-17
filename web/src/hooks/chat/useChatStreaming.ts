'use client'

import { consumeChatStream } from '@/lib/chat/stream-parser'
import { buildSystemMeta, getSystemMessage } from '@/lib/chat-system-messages'
import type { ChatProvider } from '@/lib/chat-provider-config'
import { useCallback, useRef, useState } from 'react'
import type { ChatMessage, SessionUsageMetrics, StreamPhase } from './useChatTypes'

function makeClientMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type StreamResult = 'completed' | 'forbidden' | 'failed'

export interface UseChatStreamingParams {
  onApplySelection: (provider: ChatProvider, model: string) => void
}

export function useChatStreaming({ onApplySelection }: UseChatStreamingParams) {
  const [streamPhase, setStreamPhase] = useState<StreamPhase>('idle')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const processStreamResponse = useCallback(async (
    response: Response,
    initialMessages: ChatMessage[],
    onForbidden: (errorCode: string | null) => void,
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
    setSessionMetrics: React.Dispatch<React.SetStateAction<SessionUsageMetrics | null>>,
  ): Promise<StreamResult> => {
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
            onApplySelection(parsed.provider, parsed.model)
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
  }, [onApplySelection])

  const startStreaming = useCallback(() => {
    setIsStreaming(true)
    setStreamPhase('thinking')
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const resetStreaming = useCallback(() => {
    setIsStreaming(false)
    setStreamPhase('idle')
  }, [])

  const abortStreamRef = abortRef

  return {
    streamPhase,
    setStreamPhase,
    isStreaming,
    setIsStreaming,
    abortRef: abortStreamRef,
    processStreamResponse,
    startStreaming,
    stopStreaming,
    resetStreaming,
  }
}
