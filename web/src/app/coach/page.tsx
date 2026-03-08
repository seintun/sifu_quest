'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { MessageCircle, Send, Square, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MODES = [
  { value: 'dsa', label: 'DSA Coach' },
  { value: 'system-design', label: 'System Design' },
  { value: 'interview-prep', label: 'Interview Prep' },
  { value: 'job-search', label: 'Job Search' },
  { value: 'business-ideas', label: 'Business Ideas' },
]

function ChatBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-elevated rounded-lg p-3 text-sm max-w-[80%]">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="bg-surface border border-coach/20 rounded-lg p-3 text-sm max-w-[85%]">
        <div className="prose prose-invert prose-sm max-w-none
          prose-headings:font-display prose-headings:text-foreground prose-headings:mt-3 prose-headings:mb-1
          prose-p:text-foreground/90 prose-p:my-1
          prose-a:text-coach
          prose-code:text-dsa prose-code:bg-elevated prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
          prose-pre:bg-elevated prose-pre:border prose-pre:border-border prose-pre:text-xs
          prose-li:text-foreground/90 prose-li:my-0.5
          prose-strong:text-foreground
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 bg-coach animate-pulse-cursor ml-0.5" />
        )}
      </div>
    </div>
  )
}

export default function CoachPage() {
  const [mode, setMode] = useState('dsa')
  const { messages, isStreaming, sendMessage, clearHistory, stopStreaming } = useChat(mode)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-coach" />
          <h1 className="font-display text-2xl font-bold">Coach Chat</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mode} onValueChange={v => v && setMode(v)}>
            <SelectTrigger className="w-44 bg-surface border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="text-muted-foreground hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
      <Card className="flex-1 border-border bg-background overflow-hidden">
        <CardContent className="p-0 h-full flex flex-col">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-16">
                  <MessageCircle className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Start a conversation with your {MODES.find(m => m.value === mode)?.label || 'coach'}.</p>
                  <p className="text-xs text-dim mt-1">Your chat history is saved per mode.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <ChatBubble
                  key={i}
                  message={msg}
                  isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
                />
              ))}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border p-3">
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
