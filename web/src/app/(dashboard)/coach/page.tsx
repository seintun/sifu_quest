"use client";

import { ApiKeyPrompt } from "@/components/ApiKeyPrompt";
import {
  DesktopChatControls,
  ResponsiveChatControls,
  type ModeOption,
} from "@/components/chat/ChatControls";
import { ComposerBar } from "@/components/chat/ComposerBar";
import { ConversationList } from "@/components/chat/ConversationList";
import { StatusStrip } from "@/components/chat/StatusStrip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useChat } from "@/hooks/useChat";
import { BRAND_NAME, MODE_LABELS, NAV_COPY } from "@/lib/brand";
import { buildSystemMeta, getSystemMessage } from "@/lib/chat-system-messages";
import { fetcher } from "@/lib/fetcher";
import {
  ArrowDown,
  ChevronDown,
  Home,
  KeyRound,
  MessageCircle,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import useSWR from "swr";

const MODE_STARTERS: Record<string, string[]> = {
  dsa: [
    "Give me a medium array problem",
    "Practice dynamic programming",
    "Quiz me on graphs",
    "Review sliding window",
  ],
  "system-design": [
    "Design a URL shortener",
    "Scale a newsfeed",
    "Explain consistent hashing",
    "Rate limiter design",
  ],
  "interview-prep": [
    "Start a mock interview",
    "Give me a behavioral question",
    "Ask a system design question",
    "Test me on React",
  ],
  "job-search": [
    "Help me write a resume bullet",
    "Review a job description",
    "Prep behavioral questions",
    "Analyze my pipeline",
  ],
  "business-ideas": [
    "Explore an idea I have",
    "Validate a startup concept",
    "Stress-test an idea",
    "Find a niche problem",
  ],
};

const MODES: ModeOption[] = [
  { value: "dsa", label: MODE_LABELS.dsa },
  { value: "system-design", label: MODE_LABELS["system-design"] },
  { value: "interview-prep", label: MODE_LABELS["interview-prep"] },
  { value: "job-search", label: MODE_LABELS["job-search"] },
  { value: "business-ideas", label: MODE_LABELS["business-ideas"] },
];

const BYOK_NOTICE = "BYOK in Settings for unlimited chat.";
const AI_DISCLAIMER =
  "Sifu is AI, not an all-knowing being, and can make mistakes. Verify important information.";
const SCROLL_FOLLOW_THRESHOLD_PX = 80;

function ChatSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <div className="flex gap-4 max-w-[85%]">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="h-20 w-full bg-muted/40 animate-pulse rounded-2xl rounded-tl-none" />
        </div>
      </div>
      <div className="flex gap-4 max-w-[85%] ml-auto flex-row-reverse">
        <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse shrink-0" />
        <div className="space-y-2 flex-1 flex flex-col items-end">
          <div className="h-4 w-16 bg-muted animate-pulse rounded" />
          <div className="h-12 w-3/4 bg-primary/10 animate-pulse rounded-2xl rounded-tr-none" />
        </div>
      </div>
      <div className="flex gap-4 max-w-[85%]">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="h-32 w-5/6 bg-muted/40 animate-pulse rounded-2xl rounded-tl-none" />
        </div>
      </div>
    </div>
  );
}

export default function CoachPage() {
  const [mode, setMode] = useState("dsa");
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
  } = useChat(mode);

  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const hasGreetedRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const { data: accountStatusResponse } = useSWR(
    "/api/account/status",
    fetcher,
  );
  const accountData = accountStatusResponse?.account;

  const isGuest =
    accountData?.isAnonymousSession ??
    accountData?.isGuest ??
    Boolean(freeQuota?.isGuest);

  const isQuotaBlocked = Boolean(
    freeQuota?.isFreeTier &&
    freeQuota.remaining <= 0 &&
    !(selectedProvider === "anthropic" && hasAnthropicKey),
  );

  const selectedModeLabel = useMemo(
    () => MODES.find((entry) => entry.value === mode)?.label ?? mode,
    [mode],
  );
  const selectedModeInlineLabel = useMemo(
    () => selectedModeLabel.replace(/\s*Sifu$/i, "").trim(),
    [selectedModeLabel],
  );

  useEffect(() => {
    if (!isLoaded) return;

    if (
      messages.length === 0 &&
      hasGreetedRef.current !== mode &&
      !upgradeRequired
    ) {
      if (isQuotaBlocked) {
        hasGreetedRef.current = mode;
        setMessages([
          {
            role: "assistant",
            content: getSystemMessage(
              isGuest ? "guest_limit_reached" : "free_tier_exhausted",
            ),
            meta: buildSystemMeta(
              isGuest ? "guest_limit_reached" : "free_tier_exhausted",
            ),
          },
        ]);
        return;
      }
      hasGreetedRef.current = mode;
      greet();
    }
  }, [
    mode,
    messages.length,
    greet,
    isLoaded,
    upgradeRequired,
    isQuotaBlocked,
    setMessages,
    isGuest,
  ]);

  const syncScrollState = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom < SCROLL_FOLLOW_THRESHOLD_PX;

    if (!isStreaming) {
      shouldAutoScrollRef.current = nearBottom;
    }
    setShowJumpToBottom(!nearBottom);
  }, [isStreaming]);

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (isStreaming) {
      // Follow assistant output as it grows.
      shouldAutoScrollRef.current = true;
      const rafId = window.requestAnimationFrame(() => {
        setShowJumpToBottom(false);
      });
      return () => window.cancelAnimationFrame(rafId);
    }
    const rafId = window.requestAnimationFrame(() => {
      syncScrollState();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isStreaming, syncScrollState]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      syncScrollState();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [messages, scrollToBottom, syncScrollState]);

  useEffect(() => {
    if (
      !isStreaming &&
      textareaRef.current &&
      !isQuotaBlocked &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      textareaRef.current.focus();
    }
  }, [isStreaming, isQuotaBlocked]);

  useEffect(() => {
    if (!isStreaming && isQuotaBlocked && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const isLimitMessage =
        lastMessage?.meta?.kind === "system" &&
        (lastMessage.meta.code === "free_tier_exhausted" ||
          lastMessage.meta.code === "guest_limit_reached");

      if (lastMessage && lastMessage.role === "assistant" && !isLimitMessage) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: getSystemMessage(
              isGuest ? "guest_limit_reached" : "free_tier_exhausted",
            ),
            meta: buildSystemMeta(
              isGuest ? "guest_limit_reached" : "free_tier_exhausted",
            ),
          },
        ]);
        queueMicrotask(() => setDismissedPrompt(false));
      }
    }
  }, [isStreaming, isQuotaBlocked, messages, setMessages, isGuest]);

  const handleScroll = useCallback(() => {
    syncScrollState();
  }, [syncScrollState]);

  const handleClearHistory = () => {
    hasGreetedRef.current = null;
    clearHistory();
  };

  const handleModeChange = (nextMode: string) => {
    setMode(nextMode);
    setDismissedPrompt(false);
    setStatusExpanded(false);
  };

  const handleStatusToggle = useCallback(() => {
    setStatusExpanded((prev) => !prev);
  }, []);

  const handleJumpToBottom = useCallback(() => {
    scrollToBottom();
    setShowJumpToBottom(false);
  }, [scrollToBottom]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    shouldAutoScrollRef.current = true;
    setShowJumpToBottom(false);
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const lastMessage = messages[messages.length - 1];
  const showThinkingIndicator =
    isStreaming &&
    (streamPhase === "thinking" ||
      (streamPhase === "typing" &&
        (!lastMessage || lastMessage.role === "user")));

  const anthropicProvider =
    providers.find((provider) => provider.id === "anthropic") ?? null;
  const isAnthropicLocked = Boolean(
    anthropicProvider && anthropicProvider.availability !== "available",
  );
  const byokNotice = isAnthropicLocked ? BYOK_NOTICE : null;
  const isComposerDisabled =
    isQuotaBlocked || selectedProviderInfo?.availability !== "available";
  const composerPlaceholder = isQuotaBlocked
    ? isGuest
      ? "Guest limit reached"
      : "Free limit reached"
    : "Type a message...";
  const responsiveControlsProps = {
    providers,
    selectedProvider,
    onProviderChange: updateProviderSelection,
    models: availableModelsForSelectedProvider,
    selectedModel,
    onModelChange: updateModelSelection,
    modes: MODES,
    selectedMode: mode,
    onModeChange: handleModeChange,
    onClear: handleClearHistory,
    byokNotice,
  };
  const askSifuCtaClassName =
    "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-xl border border-coach/35 bg-gradient-to-r from-coach/20 via-coach/10 to-coach/5 px-2.5 text-xs font-display font-semibold text-coach shadow-[0_8px_24px_rgb(14_165_233_/_0.2)] backdrop-blur cursor-pointer transition-all duration-150 hover:border-coach/60 hover:from-coach/25 hover:to-coach/10 hover:shadow-[0_10px_30px_rgb(14_165_233_/_0.28)] active:scale-[0.98]";
  const askSifuCtaContent = (
    <>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg bg-coach/20 ring-1 ring-coach/35">
        <MessageCircle className="h-3 w-3 text-coach shrink-0" />
      </span>
      <span>{NAV_COPY.askSifu}</span>
      <span className="relative top-px text-[10px] text-coach/70">
        ({selectedModeInlineLabel})
      </span>
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-md border border-coach/40 bg-coach/15">
        <ChevronDown className="h-2.5 w-2.5 opacity-90" />
      </span>
    </>
  );

  return (
    <div
      data-testid="coach-shell"
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+3.25rem)] bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] flex flex-col overflow-hidden md:static md:h-[calc(100dvh-3rem)]"
    >
      <div className="xl:hidden fixed top-0 left-0 right-0 md:left-56 z-40 pt-[env(safe-area-inset-top)]">
        <div className="grid h-12 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border/10 bg-surface/10 px-3 backdrop-blur-2xl">
          <Link
            href="/"
            aria-label="Go to Home Dashboard"
            className="inline-flex h-8 items-center rounded-xl border border-border/40 bg-surface/20 px-3 text-sm font-display font-semibold text-foreground shadow-sm backdrop-blur-xl transition-all duration-150 hover:border-border/60 hover:bg-surface/30 hover:shadow-md"
          >
            <Home className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            {BRAND_NAME}
          </Link>
          <div className="justify-self-center">
            <ResponsiveChatControls
              {...responsiveControlsProps}
              triggerClassName={askSifuCtaClassName}
              triggerAriaLabel="Open chat controls"
              triggerContent={askSifuCtaContent}
            />
          </div>
          <div className="justify-self-end">
            <button
              type="button"
              onClick={handleClearHistory}
              aria-label="Clear chat history"
              className="inline-flex h-8 items-center justify-center rounded-xl border border-danger/35 bg-gradient-to-r from-danger/20 via-danger/10 to-danger/5 px-2.5 text-danger hover:border-danger/55"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="hidden xl:flex items-center justify-between gap-2 mb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ResponsiveChatControls
            {...responsiveControlsProps}
            triggerClassName={askSifuCtaClassName}
            triggerAriaLabel="Open chat controls"
            triggerContent={askSifuCtaContent}
          />
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
        </div>
      </div>

      {isAnthropicLocked && anthropicProvider?.reason && (
        <div className="hidden xl:flex mb-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning items-center justify-between gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 flex-1 min-w-0 whitespace-nowrap">
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{BYOK_NOTICE}</span>
          </span>
          <Link
            href="/settings"
            className="underline underline-offset-2 whitespace-nowrap hover:text-warning/90 shrink-0"
          >
            Settings
          </Link>
        </div>
      )}

      <Card className="flex-1 border-border bg-background overflow-hidden flex flex-col min-h-0 py-0 gap-0">
        <CardContent className="p-0 flex-1 flex flex-col min-h-0 relative">
          {!isLoaded ? (
            <ChatSkeleton />
          ) : bootstrapError ? (
            <div className="flex-1 grid place-items-center px-4">
              <div className="max-w-sm text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  {bootstrapError}
                </p>
                <Button type="button" variant="outline" onClick={reload}>
                  <RotateCcw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          ) : upgradeRequired && !dismissedPrompt ? (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center min-h-0">
              {upgradeRequired === "missing_api_key" ||
              upgradeRequired === "provider_key_required" ||
              (!isGuest && upgradeRequired === "guest_limit_reached") ? (
                <ApiKeyPrompt onClose={() => setDismissedPrompt(true)} />
              ) : (
                <UpgradePrompt onClose={() => setDismissedPrompt(true)} />
              )}
            </div>
          ) : (
            <>
              {isQuotaBlocked && !isStreaming && !dismissedPrompt && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                  {isGuest ? (
                    <UpgradePrompt onClose={() => setDismissedPrompt(true)} />
                  ) : (
                    <ApiKeyPrompt onClose={() => setDismissedPrompt(true)} />
                  )}
                </div>
              )}

              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                data-testid="conversation-scroll"
                className="flex-1 overflow-y-auto overscroll-contain min-h-0 p-3 pb-28 md:px-4 md:pt-4 md:pb-32"
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

              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-1.5 pb-1.5 md:px-2 md:pb-2">
                <div className="pointer-events-auto rounded-2xl border border-border/45 bg-background/15 shadow-[0_12px_34px_rgb(2_6_23_/_0.36)] backdrop-blur-2xl">
                  <div className="px-2 pt-1.5 md:px-2.5 md:pt-2">
                    <StatusStrip
                      freeQuota={freeQuota}
                      selectedProvider={selectedProvider}
                      selectedProviderInfo={selectedProviderInfo}
                      sessionMetrics={sessionMetrics}
                      formatMicrousd={formatMicrousd}
                      isExpanded={statusExpanded}
                      onToggle={handleStatusToggle}
                    />
                  </div>

                  <ComposerBar
                    input={input}
                    onInputChange={setInput}
                    onKeyDown={handleKeyDown}
                    onSend={handleSend}
                    isStreaming={isStreaming}
                    onStop={stopStreaming}
                    isDisabled={isComposerDisabled}
                    placeholder={composerPlaceholder}
                    textareaRef={textareaRef}
                  />
                  <p className="px-3 pb-2 pt-1 text-center text-[10px] leading-tight text-foreground/70">
                    {AI_DISCLAIMER}
                  </p>
                </div>
              </div>

              {showJumpToBottom && (
                <button
                  type="button"
                  onClick={handleJumpToBottom}
                  aria-label="Jump to latest message"
                  className="absolute left-1/2 -translate-x-1/2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/25 text-foreground/90 shadow-[0_8px_20px_rgb(2_6_23_/_0.4)] backdrop-blur-xl transition-all duration-150 hover:bg-background/35 active:scale-95 bottom-[5.5rem] md:bottom-24"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
