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
      className="border-t border-border px-2.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] md:px-3 md:pt-3 md:pb-3 shrink-0 bg-background/95 supports-backdrop-filter:backdrop-blur"
    >
      <div className="flex items-end gap-1.5 md:gap-2">
        <Textarea
          data-testid="composer-input"
          ref={textareaRef}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="bg-elevated border-border resize-none min-h-10 max-h-32"
          rows={1}
          disabled={isStreaming || isDisabled}
        />
        {isStreaming ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onStop}
            className="h-10 w-10 shrink-0"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={onSend}
            disabled={!input.trim() || isDisabled}
            className="h-10 w-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
