'use client'

import { ApiKeyPrompt } from '@/components/ApiKeyPrompt'
import { ComposerBar } from '@/components/chat/ComposerBar'
import { ConversationList } from '@/components/chat/ConversationList'
import { DesktopChatControls, ResponsiveChatControls, type ModeOption } from '@/components/chat/ChatControls'
import { StatusStrip } from '@/components/chat/StatusStrip'
import { UpgradePrompt } from '@/components/UpgradePrompt'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useChat } from '@/hooks/useChat'
import { buildSystemMeta, getSystemMessage } from '@/lib/chat-system-messages'
import { KeyRound, MessageCircle, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MODE_STARTERS: Record<string, string[]> = {
  dsa: ['Give me a medium array problem', 'Practice dynamic programming', 'Quiz me on graphs', 'Review sliding window'],
  'system-design': ['Design a URL shortener', 'Scale a newsfeed', 'Explain consistent hashing', 'Rate limiter design'],
  'interview-prep': ['Start a mock interview', 'Give me a behavioral question', 'Ask a system design question', 'Test me on React'],
  'job-search': ['Help me write a resume bullet', 'Review a job description', 'Prep behavioral questions', 'Analyze my pipeline'],
  'business-ideas': ['Explore an idea I have', 'Validate a startup concept', 'Stress-test an idea', 'Find a niche problem'],
}

const MODES: ModeOption[] = [
  { value: 'dsa', label: 'DSA Coach' },
  { value: 'system-design', label: 'System Design' },
  { value: 'interview-prep', label: 'Interview Prep' },
  { value: 'job-search', label: 'Job Search' },
  { value: 'business-ideas', label: 'Business Ideas' },
]

export default function CoachPage() {
  const [mode, setMode] = useState('dsa')
  const {
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
    formatMicrousd,
  } = useChat(mode)

  const [accountIsGuest, setAccountIsGuest] = useState<boolean | null>(null)
  const [isAnonymousSession, setIsAnonymousSession] = useState<boolean | null>(null)
  const [dismissedPrompt, setDismissedPrompt] = useState(false)
  const [statusExpanded, setStatusExpanded] = useState(false)
  const [input, setInput] = useState('')

  const hasGreetedRef = useRef<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const shouldAutoScrollRef = useRef(true)

  const isGuest = isAnonymousSession === null ? (accountIsGuest ?? Boolean(freeQuota?.isGuest)) : isAnonymousSession
  const isQuotaBlocked = Boolean(
    freeQuota?.isFreeTier &&
    freeQuota.remaining <= 0 &&
    !(selectedProvider === 'anthropic' && hasAnthropicKey),
  )

  const selectedModeLabel = useMemo(() => MODES.find((entry) => entry.value === mode)?.label ?? mode, [mode])

  useEffect(() => {
    let cancelled = false

    async function loadAccountStatus() {
      try {
        const res = await fetch('/api/account/status')
        if (!res.ok || cancelled) {
          return
        }

        const data = (await res.json()) as { account?: { isGuest?: boolean; isAnonymousSession?: boolean } }
        if (typeof data.account?.isGuest === 'boolean') {
          setAccountIsGuest(data.account.isGuest)
        }
        if (typeof data.account?.isAnonymousSession === 'boolean') {
          setIsAnonymousSession(data.account.isAnonymousSession)
        }
      } catch {
        // No-op: fallback to freeQuota.isGuest behavior.
      }
    }

    void loadAccountStatus()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    if (messages.length === 0 && hasGreetedRef.current !== mode && !upgradeRequired) {
      if (isQuotaBlocked) {
        hasGreetedRef.current = mode
        setMessages([
          {
            role: 'assistant',
            content: getSystemMessage(isGuest ? 'guest_limit_reached' : 'free_tier_exhausted'),
            meta: buildSystemMeta(isGuest ? 'guest_limit_reached' : 'free_tier_exhausted'),
          },
        ])
        return
      }
      hasGreetedRef.current = mode
      greet()
    }
  }, [mode, messages.length, greet, isLoaded, upgradeRequired, isQuotaBlocked, setMessages, isGuest])

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom()
    }
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (!isStreaming && textareaRef.current && !isQuotaBlocked) {
      textareaRef.current.focus()
    }
  }, [isStreaming, isQuotaBlocked])

  useEffect(() => {
    if (!isStreaming && isQuotaBlocked && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      const isLimitMessage =
        lastMessage?.meta?.kind === 'system' &&
        (lastMessage.meta.code === 'free_tier_exhausted' || lastMessage.meta.code === 'guest_limit_reached')

      if (lastMessage && lastMessage.role === 'assistant' && !isLimitMessage) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: getSystemMessage(isGuest ? 'guest_limit_reached' : 'free_tier_exhausted'),
            meta: buildSystemMeta(isGuest ? 'guest_limit_reached' : 'free_tier_exhausted'),
          },
        ])
        queueMicrotask(() => setDismissedPrompt(false))
      }
    }
  }, [isStreaming, isQuotaBlocked, messages, setMessages, isGuest])

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < 80
  }, [])

  const handleClearHistory = () => {
    hasGreetedRef.current = null
    clearHistory()
  }

  const handleModeChange = (nextMode: string) => {
    setMode(nextMode)
    setDismissedPrompt(false)
    setStatusExpanded(false)
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    sendMessage(text)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const lastMessage = messages[messages.length - 1]
  const showThinkingIndicator =
    isStreaming &&
    (streamPhase === 'thinking' || (streamPhase === 'typing' && (!lastMessage || lastMessage.role === 'user')))

  const anthropicProvider = providers.find((provider) => provider.id === 'anthropic') ?? null
  const isAnthropicLocked = Boolean(anthropicProvider && anthropicProvider.availability !== 'available')

  return (
    <div data-testid="coach-shell" className="flex flex-col h-[calc(100dvh-5.75rem)] md:h-[calc(100dvh-3rem)] overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="h-[18px] w-[18px] text-coach shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-xl md:text-2xl leading-tight font-bold truncate">Coach Chat</h1>
            <p className="hidden sm:block text-xs text-muted-foreground truncate mt-0.5">{selectedModeLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DesktopChatControls
            providers={providers}
            selectedProvider={selectedProvider}
            onProviderChange={updateProviderSelection}
            models={availableModelsForSelectedProvider}
            selectedModel={selectedModel}
            onModelChange={updateModelSelection}
            modes={MODES}
            selectedMode={mode}
            onModeChange={handleModeChange}
            onClear={handleClearHistory}
          />
          <ResponsiveChatControls
            providers={providers}
            selectedProvider={selectedProvider}
            onProviderChange={updateProviderSelection}
            models={availableModelsForSelectedProvider}
            selectedModel={selectedModel}
            onModelChange={updateModelSelection}
            modes={MODES}
            selectedMode={mode}
            onModeChange={handleModeChange}
            onClear={handleClearHistory}
            byokNotice={isAnthropicLocked ? 'BYOK in Settings for unlimited chat.' : null}
          />
        </div>
      </div>

      {isAnthropicLocked && anthropicProvider?.reason && (
        <div className="hidden md:flex mb-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning items-center justify-between gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 flex-1 min-w-0 whitespace-nowrap">
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">BYOK in Settings for unlimited chat.</span>
          </span>
          <Link href="/settings" className="underline underline-offset-2 whitespace-nowrap hover:text-warning/90 shrink-0">
            Settings
          </Link>
        </div>
      )}

      <Card className="flex-1 border-border bg-background overflow-hidden flex flex-col min-h-0 py-0 gap-0">
        <CardContent className="p-0 flex-1 flex flex-col min-h-0 relative">
          {!isLoaded ? (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Loading chat...</div>
          ) : bootstrapError ? (
            <div className="flex-1 grid place-items-center px-4">
              <div className="max-w-sm text-center space-y-2">
                <p className="text-sm text-muted-foreground">{bootstrapError}</p>
                <Button type="button" variant="outline" onClick={reload}>
                  <RotateCcw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          ) : upgradeRequired && !dismissedPrompt ? (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center min-h-0">
              {upgradeRequired === 'missing_api_key' || upgradeRequired === 'provider_key_required' || (!isGuest && upgradeRequired === 'guest_limit_reached') ? (
                <ApiKeyPrompt onClose={() => setDismissedPrompt(true)} />
              ) : (
                <UpgradePrompt onClose={() => setDismissedPrompt(true)} />
              )}
            </div>
          ) : (
            <>
              {isQuotaBlocked && !isStreaming && !dismissedPrompt && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                  {isGuest ? <UpgradePrompt onClose={() => setDismissedPrompt(true)} /> : <ApiKeyPrompt onClose={() => setDismissedPrompt(true)} />}
                </div>
              )}

              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                data-testid="conversation-scroll"
                className="flex-1 overflow-y-auto overscroll-contain min-h-0 p-3 md:p-4"
              >
                <ConversationList
                  messages={messages}
                  isStreaming={isStreaming}
                  streamPhase={streamPhase}
                  showThinkingIndicator={showThinkingIndicator}
                  modeStarters={MODE_STARTERS[mode] ?? []}
                  onStarterClick={sendMessage}
                  hasOlderMessages={hasOlderMessages}
                  isLoadingOlder={isLoadingOlder}
                  onLoadOlder={loadOlderMessages}
                />
              </div>

              <StatusStrip
                freeQuota={freeQuota}
                selectedProvider={selectedProvider}
                selectedProviderInfo={selectedProviderInfo}
                sessionMetrics={sessionMetrics}
                formatMicrousd={formatMicrousd}
                isExpanded={statusExpanded}
                onToggle={() => setStatusExpanded((prev) => !prev)}
              />

              <ComposerBar
                input={input}
                onInputChange={setInput}
                onKeyDown={handleKeyDown}
                onSend={handleSend}
                isStreaming={isStreaming}
                onStop={stopStreaming}
                isDisabled={isQuotaBlocked || selectedProviderInfo?.availability !== 'available'}
                placeholder={
                  isQuotaBlocked
                    ? (isGuest ? 'Guest limit reached' : 'Free limit reached')
                    : 'Type a message...'
                }
                textareaRef={textareaRef}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
