'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiKeyPrompt } from '@/components/ApiKeyPrompt'
import { UpgradePrompt } from '@/components/UpgradePrompt'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import 'highlight.js/styles/github-dark.css'
import { MessageCircle, Send, Square, Trash2, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ComponentType, type HTMLAttributes } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

const FREE_TIER_EXHAUSTED_MESSAGE =
  'You have exhausted your free messages. To continue your mastery journey, go to **Settings** and add your own Anthropic API key. Your key is encrypted with AES-256-CBC before storage and used only for your Claude requests.'

const GUEST_LIMIT_REACHED_MESSAGE =
  'You have reached the guest limit. Please sign up to continue. After creating your account, add your own Anthropic API key in **Settings** to keep chatting securely.'

const MODE_STARTERS: Record<string, string[]> = {
  dsa: ['Give me a medium array problem', 'Practice dynamic programming', 'Quiz me on graphs', 'Review sliding window'],
  'system-design': ['Design a URL shortener', 'Scale a newsfeed', 'Explain consistent hashing', 'Rate limiter design'],
  'interview-prep': ['Start a mock interview', 'Give me a behavioral question', 'Ask a system design question', 'Test me on React'],
  'job-search': ['Help me write a resume bullet', 'Review a job description', 'Prep behavioral questions', 'Analyze my pipeline'],
  'business-ideas': ['Explore an idea I have', 'Validate a startup concept', 'Stress-test an idea', 'Find a niche problem'],
}

const MODES = [
  { value: 'dsa', label: 'DSA Coach' },
  { value: 'system-design', label: 'System Design' },
  { value: 'interview-prep', label: 'Interview Prep' },
  { value: 'job-search', label: 'Job Search' },
  { value: 'business-ideas', label: 'Business Ideas' },
]

type CodeBlockProps = HTMLAttributes<HTMLElement> & {
  node?: unknown
}

function CodeBlock({ className, children, node: _node, ...props }: CodeBlockProps) {
  void _node
  const match = /language-(\w+)/.exec(className || '')
  const lang = match ? match[1] : null
  
  // ReactMarkdown v10 removed the `inline` prop. Un-languaged code blocks
  // don't have a className. If it contains newlines, treat it as a block.
  const contentStr = String(children || '')
  const isInline = !className && !contentStr.includes('\n')

  if (isInline) {
    return (
      <code
        className="text-coach bg-elevated/80 px-1.5 py-0.5 rounded text-[13px] font-mono"
        {...props}
      >
        {children}
      </code>
    )
  }

  return (
    <div className="relative my-3 w-full rounded-lg overflow-hidden border border-border/60 bg-[#0d1117]">
      {lang && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-elevated/50 border-b border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-dim font-mono">{lang}</span>
        </div>
      )}
      <pre className="!m-0 !rounded-none !border-0 !bg-transparent overflow-x-auto">
        <code className={`${className || ''} font-mono !bg-transparent text-[13px] leading-relaxed block p-4`} {...props}>
          {children}
        </code>
      </pre>
    </div>
  )
}

function ChatBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-elevated rounded-xl p-3.5 text-sm max-w-[80%] whitespace-pre-wrap text-foreground/90">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="bg-surface border border-coach/15 rounded-xl p-4 text-sm max-w-[85%] shadow-sm overflow-x-auto">
        <div className="chat-prose prose prose-invert prose-sm max-w-none whitespace-pre-wrap
          prose-headings:font-display prose-headings:text-foreground
          prose-h2:text-base prose-h2:font-semibold prose-h2:mt-5 prose-h2:mb-2 prose-h2:pb-1 prose-h2:border-b prose-h2:border-border/40
          prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-1.5
          prose-h4:text-sm prose-h4:font-medium prose-h4:mt-3 prose-h4:mb-1
          prose-p:text-foreground/85 prose-p:my-1.5 prose-p:leading-relaxed
          prose-a:text-coach prose-a:no-underline hover:prose-a:underline
          prose-li:text-foreground/85 prose-li:my-0.5 prose-li:leading-relaxed
          prose-strong:text-foreground prose-strong:font-semibold
          prose-ol:my-2 prose-ul:my-2
          prose-hr:border-border/40 prose-hr:my-4
          prose-blockquote:border-coach/40 prose-blockquote:bg-coach/5 prose-blockquote:rounded-r-lg prose-blockquote:py-0.5 prose-blockquote:px-3 prose-blockquote:not-italic
          [&_table]:w-full [&_table]:my-3 [&_table]:text-sm [&_table]:border-collapse
          [&_thead]:border-b [&_thead]:border-border/50
          [&_th]:text-left [&_th]:text-foreground/70 [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider [&_th]:font-medium [&_th]:py-2 [&_th]:px-3 [&_th]:bg-elevated/40
          [&_td]:py-1.5 [&_td]:px-3 [&_td]:text-foreground/80 [&_td]:border-b [&_td]:border-border/20
          [&_tbody_tr:last-child_td]:border-0
          [&_tbody_tr:hover]:bg-elevated/30
        ">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              code: CodeBlock as ComponentType<HTMLAttributes<HTMLElement>>,
              pre: ({ children }) => <>{children}</>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-coach animate-pulse-cursor ml-0.5 mt-1" />
        )}
      </div>
    </div>
  )
}

export default function CoachPage() {
  const [mode, setMode] = useState('dsa')
  const selectedModeLabel = MODES.find(m => m.value === mode)?.label ?? mode
  const { messages, setMessages, isStreaming, isLoaded, upgradeRequired, freeQuota, sendMessage, greet, clearHistory, stopStreaming } = useChat(mode)
  const isGuest = Boolean(freeQuota?.isGuest)
  const hasGreetedRef = useRef<string | null>(null)
  const [dismissedPrompt, setDismissedPrompt] = useState(false)
  const [input, setInput] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-greet only after encrypted history has been loaded — prevents a spurious
  // greeting from firing against the empty initial state before async decrypt completes
  useEffect(() => {
    if (!isLoaded) return
    if (messages.length === 0 && hasGreetedRef.current !== mode && !upgradeRequired) {
      if (freeQuota?.isFreeTier && freeQuota.remaining <= 0) {
        hasGreetedRef.current = mode
        setMessages([{
          role: 'assistant',
          content: isGuest ? GUEST_LIMIT_REACHED_MESSAGE : FREE_TIER_EXHAUSTED_MESSAGE
        }])
        return
      }
      hasGreetedRef.current = mode
      greet()
    }
  }, [mode, messages.length, greet, isLoaded, upgradeRequired, freeQuota, setMessages, isGuest])

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Auto-focus input when assistant finishes streaming
  useEffect(() => {
    if (!isStreaming && textareaRef.current && !(freeQuota?.isFreeTier && freeQuota.remaining <= 0)) {
      textareaRef.current.focus()
    }
  }, [isStreaming, freeQuota])

  // Automatically trigger the end-of-quota experience once the 5th message finishes streaming
  useEffect(() => {
    if (!isStreaming && freeQuota?.isFreeTier && freeQuota.remaining <= 0 && messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      // Only append if we haven't already appended it
      const hasLimitMessage =
        lastMessage?.content.includes('exhausted your free messages') ||
        lastMessage?.content.includes('reached the guest limit')

      if (lastMessage && lastMessage.role === 'assistant' && !hasLimitMessage) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: isGuest
              ? GUEST_LIMIT_REACHED_MESSAGE
              : 'You have exhausted your free messages. To continue your mastery journey, go to **Settings** and add your own Anthropic API key. Your key is encrypted with AES-256-CBC before storage, and your past conversation remains accessible here.'
          }
        ])
        // Reveal the popup overlay after the stream finishes
        queueMicrotask(() => setDismissedPrompt(false))
      }
    }
  }, [isStreaming, freeQuota, messages, setMessages, isGuest])

  const handleClearHistory = () => {
    hasGreetedRef.current = null
    clearHistory()
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-coach" />
          <h1 className="font-display text-2xl font-bold">Coach Chat</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mode} onValueChange={v => v && setMode(v)}>
            <SelectTrigger className="w-44 bg-surface border-border">
              <SelectValue>{selectedModeLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {MODES.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearHistory}
            className="text-muted-foreground hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 border-border bg-background overflow-hidden flex flex-col min-h-0">
        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          {upgradeRequired ? (
             <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-center min-h-0">
                 {upgradeRequired === 'missing_api_key' ? <ApiKeyPrompt /> : <UpgradePrompt />}
             </div>
          ) : (
            <>
              {freeQuota?.isFreeTier && freeQuota.remaining <= 0 && !isStreaming && !dismissedPrompt && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                  {isGuest ? <UpgradePrompt /> : <ApiKeyPrompt onClose={() => setDismissedPrompt(true)} />}
                </div>
              )}
              {/* Scrollable messages */}
              <div
                ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 min-h-0"
          >
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <ChatBubble
                  key={i}
                  message={msg}
                  isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
                />
              ))}
              {!isStreaming && messages.length === 1 && messages[0].role === 'assistant' && (
                <div className="flex flex-wrap gap-2 mt-2 px-1">
                  {(MODE_STARTERS[mode] ?? []).map(chip => (
                    <button
                      key={chip}
                      onClick={() => sendMessage(chip)}
                      className="text-xs px-3 py-1.5 rounded-full border border-coach/30 text-coach/80 hover:bg-coach/10 hover:border-coach/60 transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 shrink-0">
            {freeQuota?.isFreeTier && (
              <div className="mb-2 rounded-md border border-border/60 bg-elevated/40 px-3 py-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-foreground/80">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Free tier usage
                  </span>
                  <span>{freeQuota.remaining} / {freeQuota.total} remaining</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-border/50 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, (freeQuota.remaining / freeQuota.total) * 100))}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  freeQuota?.isFreeTier && freeQuota.remaining <= 0
                    ? (isGuest ? 'Guest limit reached' : 'Free limit reached')
                    : 'Type a message...'
                }
                className="bg-elevated border-border resize-none min-h-[2.5rem] max-h-32"
                rows={1}
                disabled={isStreaming || (freeQuota?.isFreeTier && freeQuota.remaining <= 0)}
              />
              {isStreaming ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={stopStreaming}
                  className="shrink-0 self-end"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!input.trim() || (freeQuota?.isFreeTier && freeQuota.remaining <= 0)}
                  className="shrink-0 self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
