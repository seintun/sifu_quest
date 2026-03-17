'use client'

import { useCallback, useRef, useState } from 'react'
import type { ChatMessage } from './useChatTypes'

const PAGE_SIZE = 40

export type ChatSessionPaging = {
  hasOlder?: boolean
  nextBefore?: string | null
  nextBeforeId?: string | null
}

export { PAGE_SIZE }

export function getMessageSignature(message: ChatMessage): string {
  return message.id
    ? `id:${message.id}`
    : `${message.role}|${message.createdAt ?? ''}|${message.content}`
}

export function prependOlderMessages(current: ChatMessage[], older: ChatMessage[]): ChatMessage[] {
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

type ChatSessionResponse = {
  messages?: ChatMessage[]
  paging?: ChatSessionPaging
}

export function useChatPagination() {
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const olderAbortRef = useRef<AbortController | null>(null)

  const applyPaging = useCallback((paging: ChatSessionPaging | null | undefined) => {
    setHasOlderMessages(Boolean(paging?.hasOlder))
    setNextBefore(paging?.nextBefore ?? null)
    setNextBeforeId(paging?.nextBeforeId ?? null)
  }, [])

  const resetPaging = useCallback(() => {
    setHasOlderMessages(false)
    setNextBefore(null)
    setNextBeforeId(null)
    setIsLoadingOlder(false)
  }, [])

  const loadOlderMessages = useCallback(async (
    mode: string,
    onMessagesPrepended: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void,
  ) => {
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
      onMessagesPrepended((prev) => prependOlderMessages(prev, olderMessages))
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
  }, [nextBefore, nextBeforeId, isLoadingOlder, applyPaging])

  const abortOlder = useCallback(() => {
    olderAbortRef.current?.abort()
  }, [])

  return {
    hasOlderMessages,
    isLoadingOlder,
    applyPaging,
    resetPaging,
    loadOlderMessages,
    abortOlder,
  }
}
