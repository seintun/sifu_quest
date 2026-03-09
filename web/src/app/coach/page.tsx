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
import { useChat, type ChatMessage } from '@/hooks/useChat'
import 'highlight.js/styles/github-dark.css'
import { MessageCircle, Send, Square, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

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

function CodeBlock({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  const match = /language-(\w+)/.exec(className || '')
  const lang = match ? match[1] : null
  const isInline = !className

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
    <div className="relative my-3 rounded-lg overflow-hidden border border-border/60 bg-[#0d1117]">
      {lang && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-elevated/50 border-b border-border/40">
          <span className="text-[11px] uppercase tracking-wider text-dim font-mono">{lang}</span>
        </div>
      )}
      <pre className="!m-0 !rounded-none !border-0 !bg-transparent overflow-x-auto">
        <code className={`${className} !bg-transparent text-[13px] leading-relaxed block p-4`} {...props}>
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
      <div className="bg-surface border border-coach/15 rounded-xl p-4 text-sm max-w-[85%] shadow-sm">
        <div className="chat-prose prose prose-invert prose-sm max-w-none
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
              code: CodeBlock as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
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
  const { messages, isStreaming, sendMessage, greet, clearHistory, stopStreaming } = useChat(mode)
  const hasGreetedRef = useRef<string | null>(null)
  const [input, setInput] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-greet on mode switch when history is empty
  useEffect(() => {
    if (messages.length === 0 && hasGreetedRef.current !== mode) {
      hasGreetedRef.current = mode
      greet()
    }
  }, [mode, messages.length, greet])

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

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
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="bg-elevated border-border resize-none min-h-[2.5rem] max-h-32"
                rows={1}
                disabled={isStreaming}
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
                  disabled={!input.trim()}
                  className="shrink-0 self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
