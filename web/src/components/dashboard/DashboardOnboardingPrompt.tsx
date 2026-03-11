'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { OnboardingEnrichmentAnswers } from '@/lib/onboarding-v2'

export type EnrichmentPromptKey = 'techStack' | 'targetCompanies' | 'learningStyle' | 'strengths'

type PromptConfig = {
  title: string
  hint: string
  options: Array<{ value: string; label: string }>
  customField: keyof OnboardingEnrichmentAnswers
  valuesField: keyof OnboardingEnrichmentAnswers
  max: number
}

type DashboardOnboardingPromptProps = {
  planStatus: 'not_queued' | 'queued' | 'running' | 'ready' | 'failed'
  activePrompt: PromptConfig | null
  activePromptOptions: Array<{ value: string; label: string }>
  hasMorePromptOptions: boolean
  showAllPromptOptions: boolean
  savingEnrichment: boolean
  enrichmentDraft: OnboardingEnrichmentAnswers
  onToggleShowAll: () => void
  onToggleValue: (field: keyof OnboardingEnrichmentAnswers, value: string, maxCount: number) => void
  onCustomFieldChange: (field: keyof OnboardingEnrichmentAnswers, value: string) => void
  onSave: () => void
}

export function DashboardOnboardingPrompt({
  planStatus,
  activePrompt,
  activePromptOptions,
  hasMorePromptOptions,
  showAllPromptOptions,
  savingEnrichment,
  enrichmentDraft,
  onToggleShowAll,
  onToggleValue,
  onCustomFieldChange,
  onSave,
}: DashboardOnboardingPromptProps) {
  return (
    <section className="space-y-3" data-testid="dashboard-onboarding-prompt">
      {(planStatus === 'queued' || planStatus === 'running' || planStatus === 'failed') && (
        <Card className="border border-plan/30 bg-plan/10">
          <CardContent className="p-4">
            {planStatus === 'failed' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-plan">Plan generation needs a retry</p>
                <p className="text-xs text-muted-foreground">
                  Open Game Plan and refresh to regenerate a tailored plan.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-plan">Your personalized plan is being generated</p>
                <p className="text-xs text-muted-foreground">
                  Keep sharing updates and questions to improve personalization.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activePrompt && (
        <Card className="border border-border/70 bg-surface">
          <CardHeader className="border-b border-border/40 px-4 pt-2.5 pb-1.5">
            <CardTitle className="text-sm font-medium leading-tight">{activePrompt.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{activePrompt.hint}</p>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pt-1.5 pb-2.5">
            <div className="flex flex-wrap gap-1.5">
              {activePromptOptions.map((option, index) => {
                const values = enrichmentDraft[activePrompt.valuesField] as string[]
                const active = values.includes(option.value)
                const hiddenOnMobile = index >= 5 && !showAllPromptOptions
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onToggleValue(activePrompt.valuesField, option.value, activePrompt.max)}
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition-all duration-150 cursor-pointer',
                      active
                        ? 'bg-primary text-primary-foreground border-primary font-medium'
                        : 'bg-surface border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                      hiddenOnMobile && 'hidden sm:inline-flex',
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
              {hasMorePromptOptions && (
                <button
                  type="button"
                  onClick={onToggleShowAll}
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer sm:hidden',
                    showAllPromptOptions
                      ? 'bg-streak/20 border-streak/60 text-streak shadow-glow-streak'
                      : 'bg-plan/20 border-plan/60 text-plan shadow-glow-plan hover:bg-plan/30',
                  )}
                >
                  {showAllPromptOptions ? 'View less' : 'View more'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Optional detail for prompt"
                value={String(enrichmentDraft[activePrompt.customField] ?? '')}
                onChange={(event) => onCustomFieldChange(activePrompt.customField, event.target.value)}
                placeholder="Optional detail"
                className="h-8 bg-surface border-border text-sm flex-1"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={savingEnrichment}
                  className="h-8 rounded-md border border-border bg-elevated px-3 text-xs hover:bg-elevated/70 disabled:opacity-50"
                >
                  {savingEnrichment ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
