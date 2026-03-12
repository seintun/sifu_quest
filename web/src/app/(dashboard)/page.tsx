'use client'

import { DashboardHero } from '@/components/dashboard/DashboardHero'
import {
  DashboardOnboardingPrompt,
  type EnrichmentPromptKey,
} from '@/components/dashboard/DashboardOnboardingPrompt'
import { DashboardLaunchpad } from '@/components/dashboard/DashboardLaunchpad'
import { DashboardProgress } from '@/components/dashboard/DashboardProgress'
import { Card, CardContent } from '@/components/ui/card'
import { fetcher } from '@/lib/fetcher'
import type { DashboardMetrics } from '@/lib/metrics'
import {
  type OnboardingEnrichmentAnswers,
  LEARNING_STYLE_OPTIONS,
  STRENGTH_OPTIONS,
  TARGET_COMPANY_OPTIONS,
  TECH_STACK_OPTIONS,
  createEmptyEnrichmentAnswers,
} from '@/lib/onboarding-v2'
import { cn } from '@/lib/utils'
import { RefreshCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import useSWR from 'swr'

type OnboardingStateResponse = {
  onboarding: {
    status: 'not_started' | 'in_progress' | 'core_complete' | 'enriched_complete'
    nextPromptKey: EnrichmentPromptKey | null
  }
  plan: {
    status: 'not_queued' | 'queued' | 'running' | 'ready' | 'failed'
    lastErrorCode: string | null
  }
  draft: {
    enrichment?: Partial<OnboardingEnrichmentAnswers>
  }
}

const enrichmentPromptConfig: Record<
  EnrichmentPromptKey,
  {
    title: string
    hint: string
    options: Array<{ value: string; label: string }>
    customField: keyof OnboardingEnrichmentAnswers
    valuesField: keyof OnboardingEnrichmentAnswers
    max: number
  }
> = {
  techStack: {
    title: 'Add your primary tech stack',
    hint: 'Pick up to 8 technologies that reflect your current stack.',
    options: TECH_STACK_OPTIONS,
    customField: 'techStackCustom',
    valuesField: 'techStack',
    max: 8,
  },
  targetCompanies: {
    title: 'Add target companies or tiers',
    hint: 'Pick up to 8 targets to personalize company prep.',
    options: TARGET_COMPANY_OPTIONS,
    customField: 'targetCompaniesCustom',
    valuesField: 'targetCompanies',
    max: 8,
  },
  learningStyle: {
    title: 'How do you learn best?',
    hint: 'Pick up to 3 preferences so coaching tone matches your style.',
    options: LEARNING_STYLE_OPTIONS,
    customField: 'learningStyleCustom',
    valuesField: 'learningStyle',
    max: 3,
  },
  strengths: {
    title: 'What are your strongest areas?',
    hint: 'Pick up to 3 strengths to avoid over-practicing what you already know.',
    options: STRENGTH_OPTIONS,
    customField: 'strengthsCustom',
    valuesField: 'strengths',
    max: 3,
  },
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl animate-pulse">
      <section className="h-36 rounded-2xl border border-border bg-surface" />
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-surface" />
        ))}
      </section>
      <section className="h-56 rounded-2xl border border-border bg-surface" />
    </div>
  )
}

export default function DashboardPage() {
  const {
    data: metrics,
    error: metricsError,
    isLoading: metricsLoading,
    mutate: mutateMetrics,
  } = useSWR<DashboardMetrics>('/api/progress', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60_000,
  })

  const {
    data: onboardingData,
    mutate: mutateOnboarding,
    error: onboardingError,
  } = useSWR('/api/onboarding/status?kick=true', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const onboardingState = onboardingData ? (onboardingData as OnboardingStateResponse) : null

  const [enrichmentDraft, setEnrichmentDraft] = useState<OnboardingEnrichmentAnswers>(
    onboardingState?.draft?.enrichment
      ? { ...createEmptyEnrichmentAnswers(), ...onboardingState.draft.enrichment }
      : createEmptyEnrichmentAnswers(),
  )
  const [savingEnrichment, setSavingEnrichment] = useState(false)
  const [showAllPromptOptions, setShowAllPromptOptions] = useState(false)
  const hasShownMetricsErrorToastRef = useRef(false)
  const hasShownOnboardingErrorToastRef = useRef(false)

  useEffect(() => {
    if (metricsError && !hasShownMetricsErrorToastRef.current) {
      toast.error('Unable to load dashboard metrics.')
      hasShownMetricsErrorToastRef.current = true
    }
    if (!metricsError) {
      hasShownMetricsErrorToastRef.current = false
    }
  }, [metricsError])

  useEffect(() => {
    if (onboardingError && !hasShownOnboardingErrorToastRef.current) {
      toast.error('Unable to load onboarding prompt.')
      hasShownOnboardingErrorToastRef.current = true
    }
    if (!onboardingError) {
      hasShownOnboardingErrorToastRef.current = false
    }
  }, [onboardingError])

  useEffect(() => {
    if (onboardingState?.draft?.enrichment) {
      setEnrichmentDraft((prev) => ({
        ...prev,
        ...onboardingState.draft.enrichment,
      }))
    }
  }, [onboardingState?.draft?.enrichment])

  const planLabel = 'Game Plan'
  const planStatus = onboardingState?.plan.status ?? 'ready'
  const overallPlanPct = (metrics?.planItemsTotal ?? 0) > 0
    ? Math.round(((metrics?.planItemsCompleted ?? 0) / (metrics?.planItemsTotal ?? 1)) * 100)
    : 0

  const nextPromptKey = onboardingState?.onboarding.nextPromptKey ?? null
  const activePrompt = nextPromptKey ? enrichmentPromptConfig[nextPromptKey] : null
  const activePromptOptions = activePrompt?.options ?? []
  const hasMorePromptOptions = activePromptOptions.length > 5

  function toggleEnrichmentValue(
    field: keyof OnboardingEnrichmentAnswers,
    value: string,
    maxCount: number,
  ) {
    setEnrichmentDraft((prev) => {
      const current = Array.isArray(prev[field]) ? (prev[field] as string[]) : []
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : current.length >= maxCount
          ? current
          : [...current, value]
      return {
        ...prev,
        [field]: next,
      }
    })
  }

  async function saveEnrichmentPrompt() {
    if (!activePrompt || !nextPromptKey) {
      return
    }

    setSavingEnrichment(true)
    try {
      const response = await fetch('/api/onboarding/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrichment: enrichmentDraft }),
      })
      if (!response.ok) {
        toast.error('Unable to save this onboarding update. Please retry.')
        return
      }

      const responseData = await response.json().catch(() => null) as
        | { onboarding?: OnboardingStateResponse['onboarding']; plan?: { status?: OnboardingStateResponse['plan']['status'] } }
        | null

      if (!responseData) {
        toast.error('Saved, but received an unexpected response. Refreshing state now.')
      } else {
        toast.success('Onboarding preferences saved.')
      }

      if (responseData?.onboarding) {
        mutateOnboarding(
          (prev: OnboardingStateResponse | undefined) => {
            if (!prev) return prev
            return {
              ...prev,
              onboarding: responseData.onboarding as OnboardingStateResponse['onboarding'],
              plan: {
                status: responseData.plan?.status ?? prev.plan.status ?? 'queued',
                lastErrorCode: prev.plan.lastErrorCode ?? null,
              },
              draft: {
                enrichment: enrichmentDraft,
              },
            }
          },
          { revalidate: false },
        )
      }

      await mutateOnboarding()
    } catch {
      toast.error('Unable to save onboarding preferences right now.')
    } finally {
      setSavingEnrichment(false)
    }
  }

  if (metricsLoading && !metrics) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6 max-w-6xl" data-testid="dashboard-page">
      {(metricsError || onboardingError) && (
        <Card className="border-danger/40 bg-danger/10">
          <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
            <p className="text-xs text-danger">Some dashboard data could not be loaded.</p>
            <button
              type="button"
              onClick={() => {
                void mutateMetrics()
                void mutateOnboarding()
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10 transition-colors',
              )}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry
            </button>
          </CardContent>
        </Card>
      )}

      <DashboardHero metrics={metrics} overallPlanPct={overallPlanPct} />

      <DashboardOnboardingPrompt
        planStatus={planStatus}
        activePrompt={activePrompt}
        activePromptOptions={activePromptOptions}
        hasMorePromptOptions={hasMorePromptOptions}
        showAllPromptOptions={showAllPromptOptions}
        savingEnrichment={savingEnrichment}
        enrichmentDraft={enrichmentDraft}
        onToggleShowAll={() => setShowAllPromptOptions((prev) => !prev)}
        onToggleValue={toggleEnrichmentValue}
        onCustomFieldChange={(field, value) => setEnrichmentDraft((prev) => ({ ...prev, [field]: value }))}
        onSave={() => void saveEnrichmentPrompt()}
      />

      <DashboardLaunchpad />
      <DashboardProgress metrics={metrics} planLabel={planLabel} />
    </div>
  )
}
