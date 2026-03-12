'use client'

import type { FreeQuota, SessionUsageMetrics, ChatProviderOption } from '@/hooks/useChat'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useId, useMemo } from 'react'

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
  const detailsId = useId()
  const DetailsIcon = isExpanded ? ChevronUp : ChevronDown

  const summaryLabel = useMemo(() => {
    const labels: string[] = []

    if (freeQuota?.isFreeTier && selectedProvider === 'openrouter') {
      labels.push(`${freeQuota.remaining}/${freeQuota.total} free`) 
    }

    if (sessionMetrics) {
      labels.push(`Turns ${sessionMetrics.userTurns}`)
      labels.push(formatMicrousd(sessionMetrics.estimatedCostMicrousd))
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
    <div className="mb-1">
      <Button
        type="button"
        variant="ghost"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        className="h-auto w-full justify-between rounded-md px-1.5 py-1 text-xs text-foreground/95 hover:bg-background/20"
      >
        <span className="inline-flex items-center gap-1.5 min-w-0 text-left">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate">{summaryLabel}</span>
        </span>
        <span className="inline-flex items-center gap-1 text-foreground">
          <span>{isExpanded ? 'Hide details' : 'Details'}</span>
          <DetailsIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </span>
      </Button>

      {isExpanded && (
        <div id={detailsId} className="mt-1 space-y-1 text-xs text-foreground/90 px-1">
          {freeQuota?.isFreeTier && selectedProvider === 'openrouter' && (
            <div className="px-1.5 py-1">
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
            <div className="px-1.5 py-1 text-warning">
              {selectedProviderInfo?.reason}
            </div>
          )}

          {sessionMetrics && (
            <div className="px-1.5 py-1">
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
