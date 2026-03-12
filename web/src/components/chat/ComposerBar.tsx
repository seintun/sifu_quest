'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Square } from 'lucide-react'
import { type KeyboardEvent, type RefObject } from 'react'

type ComposerBarProps = {
  input: string
  onInputChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent) => void
  onSend: () => void
  isStreaming: boolean
  onStop: () => void
  isDisabled: boolean
  placeholder: string
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

export function ComposerBar({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  isStreaming,
  onStop,
  isDisabled,
  placeholder,
  textareaRef,
}: ComposerBarProps) {
  return (
    <div
      data-testid="composer-bar"
      className="border-t border-border/35 px-2 pt-0.5 pb-1.5 md:px-2.5 md:pt-1 md:pb-2 shrink-0 bg-transparent"
    >
      <div className="flex items-end gap-1.5 md:gap-2">
        <Textarea
          data-testid="composer-input"
          ref={textareaRef}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="bg-background/22 border-border/65 resize-none min-h-8 max-h-24 py-1 backdrop-blur-sm text-foreground placeholder:text-foreground/60"
          rows={1}
          disabled={isStreaming || isDisabled}
        />
        {isStreaming ? (
          <Button
            data-testid="composer-stop-button"
            type="button"
            size="icon"
            variant="outline"
            onClick={onStop}
            className="h-8 w-8 shrink-0"
            aria-label="Stop generating response"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            data-testid="composer-send-button"
            type="button"
            size="icon"
            onClick={onSend}
            disabled={!input.trim() || isDisabled}
            className="h-8 w-8 shrink-0"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
