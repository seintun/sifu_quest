'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createDashboardMarkdownComponents } from '@/components/markdown/dashboard-markdown-components'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ParsedPlan, PlanItem } from '@/lib/parsers/plan-parser'
import { parsePlan } from '@/lib/parsers/plan-parser'
import { DOMAIN_COLORS } from '@/lib/theme'
import { AlertTriangle, Calendar, CheckCircle2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const mdComponents = createDashboardMarkdownComponents({
  variant: 'plan',
  accentClassName: 'border-plan/30 bg-plan/5',
})

const checklistItemMdComponents: Components = {
  p: ({ children }) => <span>{children}</span>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-plan hover:underline underline-offset-2">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  code: ({ children }) => (
    <code className="text-plan bg-elevated/80 px-1.5 py-0.5 rounded text-[12px] font-mono">{children}</code>
  ),
}

const CATEGORY_DOMAINS: Record<string, keyof typeof DOMAIN_COLORS> = {
  DSA: 'dsa',
  'System Design': 'design',
  'Job Search': 'jobs',
}

type OnboardingPlanStatus = 'not_queued' | 'queued' | 'running' | 'ready' | 'failed'

type OnboardingStatusResponse = {
  plan: {
    status: OnboardingPlanStatus
    lastErrorCode: string | null
  }
}

const PLAN_PLACEHOLDER_MARKER = 'being generated in the background'

function shouldShowPlanStatusBanner(status: OnboardingPlanStatus | null): boolean {
  if (!status) {
    return false
  }

  return status === 'not_queued' || status === 'queued' || status === 'running' || status === 'failed'
}

function PlanRoadmapBadges({
  planStatus,
  planErrorCode,
}: {
  planStatus: OnboardingPlanStatus | null
  planErrorCode: string | null
}) {
  if (!planStatus) {
    return null
  }

  const baseBadgeClass = 'h-6 cursor-default pointer-events-none px-2 text-[10px] font-medium'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {planStatus === 'ready' && (
        <Badge variant="outline" className={`${baseBadgeClass} border-success/40 bg-success/10 text-success`}>
          Plan up to date
        </Badge>
      )}
      {planStatus === 'not_queued' && (
        <>
          <Badge variant="outline" className={`${baseBadgeClass} border-info/40 bg-info/10 text-info`}>
            New updates available
          </Badge>
          <Badge variant="outline" className={`${baseBadgeClass} border-border/60 bg-elevated/70 text-muted-foreground`}>
            Status: Not queued
          </Badge>
        </>
      )}
      {planStatus === 'queued' && (
        <Badge variant="outline" className={`${baseBadgeClass} border-warning/40 bg-warning/10 text-warning`}>
          Status: Queued
        </Badge>
      )}
      {planStatus === 'running' && (
        <Badge variant="outline" className={`${baseBadgeClass} border-warning/40 bg-warning/10 text-warning`}>
          Status: Running
        </Badge>
      )}
      {planStatus === 'failed' && (
        <Badge variant="outline" className={`${baseBadgeClass} border-danger/40 bg-danger/10 text-danger`}>
          Status: Failed
        </Badge>
      )}
      {planErrorCode && (
        <Badge variant="outline" className={`${baseBadgeClass} border-danger/40 bg-danger/10 text-danger`}>
          Error: {planErrorCode}
        </Badge>
      )}
    </div>
  )
}

function PlanActionButton({
  planStatus,
  canRequestRefresh,
  isQueueingPlanRefresh,
  onQueuePlanRefresh,
  className,
}: {
  planStatus: OnboardingPlanStatus | null
  canRequestRefresh: boolean
  isQueueingPlanRefresh: boolean
  onQueuePlanRefresh: () => void
  className?: string
}) {
  const isGenerating = planStatus === 'queued' || planStatus === 'running' || isQueueingPlanRefresh
  const buttonLabel = isQueueingPlanRefresh
    ? 'Queueing update...'
    : isGenerating
      ? 'Plan is being generated'
      : planStatus === 'failed'
        ? 'Retry Plan Generation'
        : 'Generate Updated Plan'
  const tooltipText = isGenerating
    ? 'Plan regeneration is currently in progress. You can keep using the app while this runs.'
    : 'Regenerates your game plan using your latest profile updates. Your checklist progress remains intact.'

  return (
    <TooltipProvider delay={180}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          onClick={onQueuePlanRefresh}
          disabled={!canRequestRefresh || isQueueingPlanRefresh}
          className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-streak/60 bg-streak/20 px-3 text-xs font-semibold text-streak shadow-glow-streak transition-all duration-150 hover:-translate-y-px hover:bg-streak/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${className ?? ''}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isQueueingPlanRefresh ? 'animate-spin' : ''}`} />
          {buttonLabel}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[18rem] leading-snug">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function PlanHeader({
  title,
  mobileTitle,
  subtitle,
  planStatus,
  planErrorCode,
  showPlanAction,
  canRequestRefresh,
  isQueueingPlanRefresh,
  onQueuePlanRefresh,
}: {
  title: string
  mobileTitle: { heading: string; subtitle: string | null }
  subtitle: string
  planStatus: OnboardingPlanStatus | null
  planErrorCode: string | null
  showPlanAction: boolean
  canRequestRefresh: boolean
  isQueueingPlanRefresh: boolean
  onQueuePlanRefresh: () => void
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display hidden text-2xl font-bold leading-tight sm:block">{title}</h1>
          <h1 className="font-display text-[1.7rem] font-bold leading-tight sm:hidden">{mobileTitle.heading}</h1>
          {mobileTitle.subtitle && <p className="mt-1 text-xs text-muted-foreground sm:hidden">{mobileTitle.subtitle}</p>}
        </div>
        {showPlanAction && (
          <div className="hidden shrink-0 pt-0.5 sm:block">
            <PlanActionButton
              planStatus={planStatus}
              canRequestRefresh={canRequestRefresh}
              isQueueingPlanRefresh={isQueueingPlanRefresh}
              onQueuePlanRefresh={onQueuePlanRefresh}
            />
          </div>
        )}
      </div>
      <div className="mt-1 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <PlanRoadmapBadges planStatus={planStatus} planErrorCode={planErrorCode} />
      </div>
      {showPlanAction && (
        <div className="mt-2 sm:hidden">
          <PlanActionButton
            planStatus={planStatus}
            canRequestRefresh={canRequestRefresh}
            isQueueingPlanRefresh={isQueueingPlanRefresh}
            onQueuePlanRefresh={onQueuePlanRefresh}
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}

function getMobileTitle(title: string): { heading: string; subtitle: string | null } {
  if (title.length <= 48) {
    return { heading: title, subtitle: null }
  }

  const truncated = title.length > 88 ? `${title.slice(0, 87).trimEnd()}...` : title
  return {
    heading: 'Your Game Plan',
    subtitle: truncated,
  }
}

function PlanCheckItem({
  item,
  onToggle,
}: {
  item: PlanItem
  onToggle: (id: string, checked: boolean) => void
}) {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    await onToggle(item.id, !item.checked)
    setLoading(false)
  }

  return (
    <div className="flex items-start gap-3 py-1.5">
      <Checkbox
        checked={item.checked}
        onCheckedChange={handleToggle}
        disabled={loading}
        className="mt-0.5"
      />
      <div className={`text-sm ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={checklistItemMdComponents}>
          {item.text}
        </ReactMarkdown>
      </div>
    </div>
  )
}

function MonthProgress({ items }: { items: PlanItem[] }) {
  const total = items.length
  const done = items.filter(i => i.checked).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-1.5 mb-4">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{done}/{total} completed</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${DOMAIN_COLORS.plan.hex}, #FB923C)`,
          }}
        />
      </div>
    </div>
  )
}

function extractTitle(content: string): string {
  const match = content.match(/^# (.+)/m)
  return match ? match[1].trim() : 'My Plan'
}

function stripLeadingHeading(content: string): string {
  return content.replace(/^# .+\n{1,2}/, '').trim()
}

function hasStructuredContent(plan: ParsedPlan): boolean {
  return plan.months.length > 0 || plan.immediateSteps.length > 0 || (plan.weeklyRhythm?.length ?? 0) > 0
}

export default function PlanPage() {
  const [plan, setPlan] = useState<ParsedPlan | null>(null)
  const [rawContent, setRawContent] = useState('')
  const [planStatus, setPlanStatus] = useState<OnboardingPlanStatus | null>(null)
  const [planErrorCode, setPlanErrorCode] = useState<string | null>(null)
  const [isQueueingPlanRefresh, setIsQueueingPlanRefresh] = useState(false)

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/memory?file=plan.md')
      const data = await res.json().catch(() => ({}))
      const content = typeof data.content === 'string' ? data.content : ''
      setRawContent(content)
      setPlan(parsePlan(content))
      return content
    } catch {
      return ''
    }
  }, [])

  const fetchOnboardingStatus = useCallback(async (kick: boolean) => {
    try {
      const res = await fetch(kick ? '/api/onboarding/status?kick=true' : '/api/onboarding/status')
      if (!res.ok) {
        return null
      }
      const data = (await res.json()) as OnboardingStatusResponse
      setPlanStatus(data.plan.status)
      setPlanErrorCode(data.plan.lastErrorCode ?? null)
      return data
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await fetchPlan()
      await fetchOnboardingStatus(true)
      await fetchPlan()
    })()
  }, [fetchPlan, fetchOnboardingStatus])

  const isPlanPlaceholder = rawContent.toLowerCase().includes(PLAN_PLACEHOLDER_MARKER)

  useEffect(() => {
    const shouldPoll =
      planStatus === 'queued' ||
      planStatus === 'running' ||
      (isPlanPlaceholder && planStatus !== 'failed')

    if (!shouldPoll) {
      return
    }

    let isActive = true
    const tick = async () => {
      await fetchOnboardingStatus(true)
      if (!isActive) {
        return
      }
      await fetchPlan()
    }

    void tick()
    const intervalId = window.setInterval(() => {
      void tick()
    }, 15000)

    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [fetchOnboardingStatus, fetchPlan, isPlanPlaceholder, planStatus])

  const refreshPlanStatus = useCallback(async () => {
    await fetchOnboardingStatus(true)
    await fetchPlan()
  }, [fetchOnboardingStatus, fetchPlan])

  const queuePlanRefresh = useCallback(async () => {
    setIsQueueingPlanRefresh(true)
    try {
      const res = await fetch('/api/onboarding/plan/refresh', {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({})) as {
        error?: string
        plan?: { status?: OnboardingPlanStatus }
      }
      if (!res.ok) {
        setPlanErrorCode(data.error ?? 'plan_refresh_failed')
        return
      }

      setPlanStatus(data.plan?.status ?? 'queued')
      setPlanErrorCode(null)
      void refreshPlanStatus()
    } finally {
      setIsQueueingPlanRefresh(false)
    }
  }, [refreshPlanStatus])

  const handleToggle = async (itemId: string, checked: boolean) => {
    try {
      const res = await fetch('/api/plan/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, checked }),
      })
      if (res.ok) {
        fetchPlan()
      }
    } catch {
      // ignore
    }
  }

  if (!plan) {
    return <div className="text-muted-foreground">Loading plan...</div>
  }

  const title = extractTitle(rawContent)
  const mobileTitle = getMobileTitle(title)
  const firstMonthValue = plan.months[0] ? `month${plan.months[0].month}` : ''
  const canRequestRefresh = planStatus !== null && planStatus !== 'queued' && planStatus !== 'running'
  const showPlanStatusBanner = shouldShowPlanStatusBanner(planStatus)
  const fallbackMarkdownContent = stripLeadingHeading(rawContent)

  // AI-generated plan: fall back to markdown rendering
  if (!hasStructuredContent(plan)) {
    return (
      <div className="max-w-4xl space-y-4 sm:space-y-6">
        <PlanHeader
          title={title}
          mobileTitle={mobileTitle}
          subtitle="Your personalized roadmap"
          planStatus={planStatus}
          planErrorCode={planErrorCode}
          showPlanAction={showPlanStatusBanner}
          canRequestRefresh={canRequestRefresh}
          isQueueingPlanRefresh={isQueueingPlanRefresh}
          onQueuePlanRefresh={() => void queuePlanRefresh()}
        />
        {fallbackMarkdownContent ? (
          <Card className="border-border bg-surface pt-0">
            <CardContent className="px-4 pt-1 pb-4 sm:px-6 sm:pt-1 sm:pb-5 [&>*:first-child]:!mt-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {fallbackMarkdownContent}
              </ReactMarkdown>
            </CardContent>
          </Card>
        ) : (
          <p className="text-muted-foreground text-sm">No plan yet. Complete onboarding to generate your personalized game plan.</p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-6">
      <PlanHeader
        title={title}
        mobileTitle={mobileTitle}
        subtitle="Your structured roadmap to interview success"
        planStatus={planStatus}
        planErrorCode={planErrorCode}
        showPlanAction={showPlanStatusBanner}
        canRequestRefresh={canRequestRefresh}
        isQueueingPlanRefresh={isQueueingPlanRefresh}
        onQueuePlanRefresh={() => void queuePlanRefresh()}
      />

      {/* Weekly Rhythm */}
      {plan.weeklyRhythm?.length > 0 && (
        <Card className="border-border bg-surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-streak" />
              Weekly Rhythm
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {plan.weeklyRhythm.map(entry => (
                <div key={entry.day} className="bg-elevated rounded-md p-2 text-center text-xs">
                  <p className="font-medium text-foreground">{entry.day}</p>
                  <p className="text-muted-foreground mt-0.5 truncate">{entry.focus}</p>
                  <p className="text-dim text-[10px] mt-0.5">{entry.time}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month Tabs */}
      {plan.months.length > 0 && (
        <Tabs defaultValue={firstMonthValue}>
          <TabsList className="bg-elevated">
            {plan.months.map(month => (
              <TabsTrigger key={month.month} value={`month${month.month}`}>
                Month {month.month}
              </TabsTrigger>
            ))}
          </TabsList>

          {plan.months.map(month => {
            const allItems = Object.values(month.categories).flat()
            return (
              <TabsContent key={month.month} value={`month${month.month}`} className="space-y-4 mt-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">{month.title}</h2>
                  {month.theme && <p className="text-sm text-muted-foreground">{month.theme}</p>}
                </div>

                <MonthProgress items={allItems} />

                {Object.entries(month.categories).map(([category, items]) => {
                  const domain = CATEGORY_DOMAINS[category] || 'streak'
                  const colors = DOMAIN_COLORS[domain]

                  return (
                    <Card key={category} className={`${colors.bg} border ${colors.border}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className={`text-sm font-medium ${colors.text} flex items-center gap-2`}>
                          <CheckCircle2 className="h-4 w-4" />
                          {category}
                          <Badge variant="outline" className="ml-auto text-xs">
                            {items.filter(i => i.checked).length}/{items.length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-0.5">
                        {items.map(item => (
                          <PlanCheckItem key={item.id} item={item} onToggle={handleToggle} />
                        ))}
                      </CardContent>
                    </Card>
                  )
                })}
              </TabsContent>
            )
          })}
        </Tabs>
      )}

      {/* Immediate Steps */}
      {plan.immediateSteps.length > 0 && (
        <Card className="border-plan/30 bg-plan/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-plan flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Immediate Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0.5">
            {plan.immediateSteps.map(item => (
              <PlanCheckItem key={item.id} item={item} onToggle={handleToggle} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Red Flags */}
      {plan.redFlags.length > 0 && (
        <Card className="border-border bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-warning flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Red Flags to Watch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plan.redFlags.map((flag, i) => (
                <div key={i} className="text-sm">
                  <p className="text-foreground font-medium">{flag.symptom}</p>
                  <p className="text-muted-foreground mt-0.5">{flag.fix}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
