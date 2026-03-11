'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DOMAIN_COLORS } from '@/lib/theme'
import {
  type OnboardingEnrichmentAnswers,
  LEARNING_STYLE_OPTIONS,
  STRENGTH_OPTIONS,
  TARGET_COMPANY_OPTIONS,
  TECH_STACK_OPTIONS,
  createEmptyEnrichmentAnswers,
} from '@/lib/onboarding-v2'
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Code2,
  Flame,
  MessageCircle,
  Network,
  Settings,
  Target,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'

interface DashboardMetrics {
  dsaPatternsTotal: number
  dsaPatternsMastered: number
  dsaPatternsInProgress: number
  dsaProblemsCompleted: number
  jobApplicationsTotal: number
  jobApplicationsByStatus: Record<string, number>
  systemDesignConceptsCovered: number
  planItemsTotal: number
  planItemsCompleted: number
  currentStreak: number
  todayFocus: { day: string; focus: string; time: string } | null
  weeklyRhythm: Array<{ day: string; focus: string; time: string }>
  planLabel: string
  currentMonth: number
  currentPlanPeriodLabel: string
}

type EnrichmentPromptKey = 'techStack' | 'targetCompanies' | 'learningStyle' | 'strengths'

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

function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl animate-pulse">
      {/* Header Skeleton */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-elevated/40 to-surface p-5 sm:p-6">
        <div className="space-y-4">
          <div className="h-8 w-48 bg-muted rounded-md" />
          <div className="h-4 w-64 bg-muted/60 rounded-md" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-24 bg-muted/80 rounded-md" />
            <div className="h-6 w-24 bg-muted/80 rounded-md" />
          </div>
        </div>
      </section>

      {/* Metrics Grid Skeleton */}
      <div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-[104px] border-border bg-surface">
              <CardContent className="p-3 sm:p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-3">
                    <div className="h-3 w-20 bg-muted rounded" />
                    <div className="h-8 w-12 bg-muted/80 rounded" />
                  </div>
                  <div className="h-7 w-7 sm:h-8 sm:w-8 bg-muted rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions Skeleton */}
      <section className="space-y-3">
        <div className="h-5 w-32 bg-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-[88px] border-border bg-surface">
              <CardContent className="p-4">
                <div className="flex gap-4 items-start">
                  <div className="h-7 w-7 bg-muted rounded-md shrink-0" />
                  <div className="space-y-2 w-full">
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-3 w-40 bg-muted/60 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Bottom Layout Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card className="xl:col-span-2 border-border bg-surface h-[200px]">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="h-5 w-32 bg-muted rounded" />
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="space-y-2">
              <div className="h-3 w-1/4 bg-muted/60 rounded" />
              <div className="h-2 w-full bg-muted rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-1/4 bg-muted/60 rounded" />
              <div className="h-2 w-full bg-muted rounded-full" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-surface h-[200px]">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="h-5 w-32 bg-muted rounded" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted/30 rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  domain,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  domain: keyof typeof DOMAIN_COLORS
}) {
  const colors = DOMAIN_COLORS[domain]
  return (
    <Card className={`h-full ${colors.bg} border ${colors.border} ${colors.glow} transition-all duration-200 hover:-translate-y-0.5`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={`text-xl sm:text-2xl font-display font-bold mt-1 ${colors.text}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{subtitle}</p>}
          </div>
          <span className={`inline-flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border ${colors.border} ${colors.bg}`}>
            <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${colors.text} opacity-80`} />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function ProgressBar({
  label,
  current,
  total,
  startHex,
  endHex,
}: {
  label: string
  current: number
  total: number
  startHex: string
  endHex: string
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">{current}/{total} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${startHex}, ${endHex})`,
          }}
        />
      </div>
    </div>
  )
}

function QuickActionCard({
  href,
  label,
  hint,
  icon: Icon,
  domain,
}: {
  href: string
  label: string
  hint: string
  icon: React.ElementType
  domain: keyof typeof DOMAIN_COLORS
}) {
  const colors = DOMAIN_COLORS[domain]

  return (
    <Link href={href} className="group">
      <Card className={`h-full border ${colors.border} ${colors.bg} ${colors.glow} transition-all duration-200 hover:-translate-y-0.5`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${colors.border} ${colors.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                </span>
                <p className="text-sm font-medium text-foreground">{label}</p>
              </div>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function DashboardPage() {
  const { data: metrics } = useSWR<DashboardMetrics>('/api/progress', fetcher)
  const { data: onboardingData, mutate: mutateOnboarding } = useSWR('/api/onboarding/status?kick=true', fetcher)

  const onboardingState = onboardingData ? (onboardingData as OnboardingStateResponse) : null

  // We only track the enrichment drafting locally since it's a WIP form state
  const [enrichmentDraft, setEnrichmentDraft] = useState<OnboardingEnrichmentAnswers>(
    onboardingState?.draft?.enrichment
      ? { ...createEmptyEnrichmentAnswers(), ...onboardingState.draft.enrichment }
      : createEmptyEnrichmentAnswers()
  )
  const [savingEnrichment, setSavingEnrichment] = useState(false)
  const [showAllPromptOptions, setShowAllPromptOptions] = useState(false)

  useEffect(() => {
    if (onboardingState?.draft?.enrichment) {
      setEnrichmentDraft(prev => ({
        ...prev,
        ...onboardingState.draft.enrichment,
      }))
    }
  }, [onboardingState?.draft?.enrichment])

  const nextPromptKey = onboardingState?.onboarding.nextPromptKey ?? null

  const planHref = '/plan'
  const planLabel = 'Game Plan'
  const overallPlanPct = (metrics?.planItemsTotal ?? 0) > 0
    ? Math.round(((metrics?.planItemsCompleted ?? 0) / (metrics?.planItemsTotal ?? 1)) * 100)
    : 0
  const dsaMasteryPct = (metrics?.dsaPatternsTotal ?? 0) > 0
    ? Math.round(((metrics?.dsaPatternsMastered ?? 0) / (metrics?.dsaPatternsTotal ?? 1)) * 100)
    : 0
  const applicationsSummary = Object.entries(metrics?.jobApplicationsByStatus ?? {})
    .map(([status, count]) => `${count} ${status}`)
    .join(', ') || 'No pipeline yet'
  const quickActions: Array<{
    href: string
    label: string
    hint: string
    icon: React.ElementType
    domain: keyof typeof DOMAIN_COLORS
  }> = [
    { href: '/dsa', label: 'Practice DSA', hint: 'Solve by pattern and track mastery', icon: Code2, domain: 'dsa' },
    { href: '/jobs', label: 'Log Applications', hint: 'Keep your pipeline updated', icon: Briefcase, domain: 'jobs' },
    { href: '/system-design', label: 'System Design', hint: 'Capture concepts and depth', icon: Network, domain: 'design' },
    { href: planHref, label: planLabel, hint: 'Review this week\'s priorities', icon: ClipboardList, domain: 'plan' },
    { href: '/coach', label: 'Coach Chat', hint: 'Get feedback for interview prep', icon: MessageCircle, domain: 'coach' },
    { href: '/memory', label: 'Open Memory', hint: 'Revisit notes and corrections', icon: BookOpen, domain: 'streak' },
    { href: '/settings', label: 'Account Settings', hint: 'Update your profile and API key', icon: Settings, domain: 'streak' },
  ]

  const planStatus = onboardingState?.plan.status ?? 'ready'

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
        return
      }

      const responseData = await response.json().catch(() => null) as
        | { onboarding?: OnboardingStateResponse['onboarding']; plan?: { status?: OnboardingStateResponse['plan']['status'] } }
        | null

      if (responseData?.onboarding) {
        mutateOnboarding(
          (prev: any) => {
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
          { revalidate: false } // Don't revalidate immediately, let the fetch below handle it
        )
      }

      // Refresh latest draft/status without blocking the save interaction.
      void mutateOnboarding() // Revalidate the onboarding status
        .then((refreshed: any) => {
          if (!refreshed) {
            return
          }
          setEnrichmentDraft((prev) => ({
            ...prev,
            ...(refreshed.draft?.enrichment ?? {}),
          }))
        })
        .catch(() => {})
    } finally {
      setSavingEnrichment(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-elevated/40 to-surface">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-plan/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-streak/10 blur-3xl" />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground text-sm mt-1">Your job search at a glance</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {metrics ? (
                  <>
                    <span className="rounded-md border border-border bg-elevated/70 px-2.5 py-1 text-xs text-muted-foreground">
                      {overallPlanPct}% complete
                    </span>
                    <span className="rounded-md border border-border bg-elevated/70 px-2.5 py-1 text-xs text-muted-foreground">
                      {metrics?.currentStreak ?? 0} day streak
                    </span>
                  </>
                ) : (
                  <div className="flex gap-2 animate-pulse mt-0.5">
                    <div className="h-6 w-24 bg-muted/80 rounded-md" />
                    <div className="h-6 w-24 bg-muted/80 rounded-md" />
                  </div>
                )}
              </div>
            </div>

            {metrics?.todayFocus && (
              <div className="min-w-[230px] rounded-xl border border-streak/30 bg-streak/10 p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-streak/30 bg-streak/15">
                    <Target className="h-4 w-4 text-streak" />
                  </span>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Today&apos;s Focus</p>
                    <p className="font-display font-semibold text-streak mt-0.5">{metrics.todayFocus.focus}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{metrics.todayFocus.time}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {(planStatus === 'queued' || planStatus === 'running' || planStatus === 'failed') && (
        <Card className="border border-plan/30 bg-plan/10">
          <CardContent className="p-4">
            {planStatus === 'failed' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-plan">Plan generation needs a retry</p>
                <p className="text-xs text-muted-foreground">
                  Any new responses you share help personalize your guidance. Open Game Plan and refresh to regenerate a tailored plan.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-plan">Your personalized plan is being generated</p>
                <p className="text-xs text-muted-foreground">
                  Keep sharing updates and questions. They improve personalization, and you can generate a new Game Plan anytime for refreshed recommendations.
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
                    onClick={() =>
                      toggleEnrichmentValue(activePrompt.valuesField, option.value, activePrompt.max)
                    }
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
                  onClick={() => setShowAllPromptOptions((prev) => !prev)}
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
                value={String(enrichmentDraft[activePrompt.customField] ?? '')}
                onChange={(event) =>
                  setEnrichmentDraft((prev) => ({
                    ...prev,
                    [activePrompt.customField]: event.target.value,
                  }))
                }
                placeholder="Optional detail"
                className="h-8 bg-surface border-border text-sm flex-1"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveEnrichmentPrompt()}
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

      {/* Metrics Grid */}
      <div className="max-h-[33vh] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
          {(!metrics) ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="h-[104px] border-border bg-surface animate-pulse">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-3">
                      <div className="h-3 w-20 bg-muted rounded" />
                      <div className="h-8 w-12 bg-muted/80 rounded" />
                    </div>
                    <div className="h-7 w-7 sm:h-8 sm:w-8 bg-muted rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <MetricCard
                title="DSA Problems"
                value={metrics?.dsaProblemsCompleted ?? 0}
                subtitle={`${metrics?.dsaPatternsMastered ?? 0}/${metrics?.dsaPatternsTotal ?? 0} patterns mastered (${dsaMasteryPct}%)`}
                icon={Code2}
                domain="dsa"
              />
              <MetricCard
                title="Applications"
                value={metrics?.jobApplicationsTotal ?? 0}
                subtitle={applicationsSummary}
                icon={Briefcase}
                domain="jobs"
              />
              <MetricCard
                title="System Design"
                value={metrics?.systemDesignConceptsCovered ?? 0}
                subtitle="concepts covered"
                icon={Network}
                domain="design"
              />
              <MetricCard
                title="Streak"
                value={`${metrics?.currentStreak ?? 0} days`}
                icon={Flame}
                domain="streak"
              />
            </>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">Quick Actions</h2>
          <p className="text-xs text-muted-foreground">Jump into your next interview task</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {quickActions.map(action => (
            <QuickActionCard
              key={action.href}
              href={action.href}
              label={action.label}
              hint={action.hint}
              icon={action.icon}
              domain={action.domain}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Plan Progress */}
        <Card className="xl:col-span-2 border border-border bg-surface">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-plan" />
                {planLabel} Progress
              </CardTitle>
              <Link
                href={planHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-plan hover:text-plan/80 transition-colors"
              >
                Open Plan
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {!metrics ? (
              <div className="space-y-6 animate-pulse">
                <div className="space-y-2">
                  <div className="h-3 w-1/4 bg-muted/60 rounded" />
                  <div className="h-2 w-full bg-muted rounded-full" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-1/4 bg-muted/60 rounded" />
                  <div className="h-2 w-full bg-muted rounded-full" />
                </div>
              </div>
            ) : (
              <>
                <ProgressBar
                  label="Overall Plan"
                  current={metrics?.planItemsCompleted ?? 0}
                  total={metrics?.planItemsTotal ?? 0}
                  startHex={DOMAIN_COLORS.plan.hex}
                  endHex="#FB923C"
                />
                <ProgressBar
                  label="DSA Patterns"
                  current={metrics?.dsaPatternsMastered ?? 0}
                  total={metrics?.dsaPatternsTotal ?? 0}
                  startHex={DOMAIN_COLORS.dsa.hex}
                  endHex={DOMAIN_COLORS.design.hex}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Weekly Rhythm */}
        <Card className="border border-border bg-surface">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-streak" />
              Weekly Rhythm
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {!metrics ? (
              <div className="grid grid-cols-2 gap-2 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 bg-muted/30 rounded-lg" />
                ))}
              </div>
            ) : (metrics?.weeklyRhythm?.length ?? 0) > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {metrics?.weeklyRhythm?.map(entry => {
                  const isToday = metrics?.todayFocus?.day === entry.day
                  return (
                    <div
                      key={entry.day}
                      className={cn(
                        'rounded-lg p-2 text-xs border',
                        isToday
                          ? 'border-streak/40 bg-streak/10 text-streak'
                          : 'border-border/50 bg-elevated/40 text-muted-foreground'
                      )}
                    >
                      <p className="font-medium">{entry.day}</p>
                      <p className="truncate mt-0.5">{entry.focus}</p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No weekly rhythm set yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
