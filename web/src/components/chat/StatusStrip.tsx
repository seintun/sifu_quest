'use client'

import type { FreeQuota, SessionUsageMetrics, ChatProviderOption } from '@/hooks/useChat'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { useMemo } from 'react'

type StatusStripProps = {
  freeQuota: FreeQuota | null
  selectedProvider: 'openrouter' | 'anthropic'
  selectedProviderInfo: ChatProviderOption | null
  sessionMetrics: SessionUsageMetrics | null
  formatMicrousd: (value: number) => string
  isExpanded: boolean
  onToggle: () => void
}

export function StatusStrip({
  freeQuota,
  selectedProvider,
  selectedProviderInfo,
  sessionMetrics,
  formatMicrousd,
  isExpanded,
  onToggle,
}: StatusStripProps) {
  const summaryLabel = useMemo(() => {
    const labels: string[] = []

    if (freeQuota?.isFreeTier && selectedProvider === 'openrouter') {
      labels.push(`${freeQuota.remaining}/${freeQuota.total} free`) 
    }

    if (sessionMetrics) {
      labels.push(`Turns ${sessionMetrics.userTurns}`)
      labels.push(`Cost ${formatMicrousd(sessionMetrics.estimatedCostMicrousd)}`)
    }

    if (selectedProviderInfo?.availability !== 'available' && selectedProviderInfo?.reason) {
      labels.push('Provider unavailable')
    }

    return labels.length > 0 ? labels.join(' • ') : 'Session info'
  }, [freeQuota, selectedProvider, sessionMetrics, selectedProviderInfo, formatMicrousd])

  const showAnything = Boolean(
    (freeQuota?.isFreeTier && selectedProvider === 'openrouter') ||
    (selectedProviderInfo && selectedProviderInfo.availability !== 'available') ||
    sessionMetrics,
  )

  if (!showAnything) return null

  return (
    <div className="mb-2 rounded-md border border-border/60 bg-elevated/30 px-2.5 py-2">
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        className="h-auto w-full justify-between px-1 py-0 text-xs text-foreground/80"
      >
        <span className="inline-flex items-center gap-1.5 min-w-0 text-left">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate">{summaryLabel}</span>
        </span>
        <span>{isExpanded ? 'Hide' : 'Details'}</span>
      </Button>

      {isExpanded && (
        <div className="mt-2 space-y-2 text-xs text-foreground/80">
          {freeQuota?.isFreeTier && selectedProvider === 'openrouter' && (
            <div className="rounded-md border border-border/60 bg-elevated/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2 font-medium">
                <span>Free tier usage</span>
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

          {selectedProviderInfo?.availability !== 'available' && selectedProviderInfo?.reason && (
            <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-warning">
              {selectedProviderInfo?.reason}
            </div>
          )}

          {sessionMetrics && (
            <div className="rounded-md border border-border/60 bg-elevated/40 px-3 py-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Turns: {sessionMetrics.userTurns}</span>
                <span>Input tokens: {sessionMetrics.inputTokens}</span>
                <span>Output tokens: {sessionMetrics.outputTokens}</span>
                <span>Total tokens: {sessionMetrics.totalTokens}</span>
                <span>Est. cost: {formatMicrousd(sessionMetrics.estimatedCostMicrousd)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
