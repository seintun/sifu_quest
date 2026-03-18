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
import { normalizeMarkdownContent } from '@/lib/markdown-formatting'
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Target, LayoutDashboard, Info, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
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
  'Behavioral': 'coach',
}

/**
 * Extract category name and time budget from category string
 * "DSA (4 hrs)" → { name: "DSA", timeBudget: "4 hrs" }
 * "System Design" → { name: "System Design", timeBudget: null }
 */
function parseCategoryInfo(category: string): { name: string; timeBudget: string | null } {
  const timeMatch = category.match(/^(.+?)\s*\(([^)]+(?:hrs?|hours?|mins?|minutes?)[^)]*)\)\s*$/i)
  if (timeMatch) {
    return { name: timeMatch[1].trim(), timeBudget: timeMatch[2].trim() }
  }
  return { name: category, timeBudget: null }
}

type OnboardingPlanStatus = 'not_queued' | 'queued' | 'running' | 'ready' | 'failed'

const PLAN_PLACEHOLDER_MARKER = 'being generated in the background'

function shouldShowPlanStatusBanner(status: OnboardingPlanStatus | null): boolean {
  if (!status) return false
  return status === 'not_queued' || status === 'queued' || status === 'running' || status === 'failed'
}

function PlanRoadmapBadges({
  planStatus,
  planErrorCode,
}: {
  planStatus: OnboardingPlanStatus | null
  planErrorCode: string | null
}) {
  if (!planStatus) return null
  const baseBadgeClass = 'h-6 cursor-default pointer-events-none px-2 text-[10px] font-medium'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {planStatus === 'ready' && (
        <Badge variant="outline" className={`${baseBadgeClass} border-success/40 bg-success/10 text-success`}>
          Plan up to date
        </Badge>
      )}
      {planStatus === 'not_queued' && (
        <Badge variant="outline" className={`${baseBadgeClass} border-info/40 bg-info/10 text-info`}>
          New updates available
        </Badge>
      )}
      {(planStatus === 'queued' || planStatus === 'running') && (
        <Badge variant="outline" className={`${baseBadgeClass} border-warning/40 bg-warning/10 text-warning animate-pulse`}>
          Status: {planStatus === 'queued' ? 'Queued' : 'Generating...'}
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
      ? 'Generating Plan'
      : 'Refresh Game Plan'

  return (
    <TooltipProvider delay={180}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          onClick={onQueuePlanRefresh}
          disabled={!canRequestRefresh || isQueueingPlanRefresh}
          className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-streak/60 bg-streak/20 px-3 text-xs font-semibold text-streak shadow-glow-streak transition-all duration-150 hover:-translate-y-px hover:bg-streak/30 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:opacity-50 ${className ?? ''}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isQueueingPlanRefresh ? 'animate-spin' : ''}`} />
          {buttonLabel}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[18rem] bg-surface border-border/80 shadow-xl">
          Regenerates your game plan using your latest profile updates. Progress remains intact.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function PlanMetadataGrid({ metadata }: { metadata: { key: string; value: string }[] }) {
  if (!metadata.length) return null
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
      {metadata.map((item, i) => {
        const isProfile = item.key.toLowerCase().includes('profile')
        const parts = item.value.split('|').map(p => p.trim()).filter(Boolean)
        const hasTags = parts.length > 1

        return (
          <div key={i} className={`flex flex-col p-2.5 rounded-xl border border-border/40 bg-surface/50 backdrop-blur-sm ${isProfile ? 'col-span-full shadow-sm' : ''}`}>
            <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/60 mb-1.5 ml-0.5">{item.key}</span>
            {hasTags ? (
              <div className="flex flex-wrap gap-1.5">
                {parts.map((part, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className="bg-elevated/40 text-[10px] py-0 px-2 h-[22px] border-border/30 text-foreground/90 font-semibold rounded-md shadow-sm ring-1 ring-inset ring-foreground/5 hover:bg-plan/10 hover:text-plan transition-colors"
                  >
                    {part}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-[12px] font-medium text-foreground leading-tight px-0.5 whitespace-normal break-words">{item.value}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PlanDashboardTable({ dashboard }: { dashboard: ParsedPlan['dashboard'] }) {
  if (!dashboard.headers.length || !dashboard.rows.length) return null
  return (
    <Card className="border-border/30 bg-surface/40 backdrop-blur-md mb-4 overflow-hidden">
      <CardHeader className="py-2 px-3 border-b border-border/20 bg-elevated/30">
        <CardTitle className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
          <LayoutDashboard className="h-3 w-3" />
          Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-[11px] text-left">
          <thead>
            <tr className="bg-elevated/10">
              {dashboard.headers.map(h => (
                <th key={h} className="px-3 py-1.5 border-r border-border/10 last:border-0 font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {dashboard.rows.map((row, i) => (
              <tr key={i} className="hover:bg-elevated/5 transition-colors">
                {dashboard.headers.map(h => (
                  <td key={h} className="px-3 py-1.5 border-r border-border/10 last:border-0 font-medium">
                    {row[h].includes('🔴') || row[h].includes('🟡') || row[h].includes('🟢') ? (
                      <Badge variant="outline" className="text-[9px] py-0 h-4 px-1 border-border/40 bg-surface">
                        {row[h]}
                      </Badge>
                    ) : (
                      row[h]
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function PlanCheckItem({
  item,
  onToggle,
}: {
  item: PlanItem
  onToggle: (id: string, checked: boolean) => void
}) {
  const [loading, setLoading] = useState(false)
  const normalizedItemText = useMemo(() => normalizeMarkdownContent(item.text), [item.text])

  const handleToggle = async () => {
    setLoading(true)
    await onToggle(item.id, !item.checked)
    setLoading(false)
  }

  const isInfoItem = item.id.includes('-info-')

  return (
    <div className={`flex items-start gap-2 py-1 transition-opacity ${loading ? 'opacity-50' : ''}`}>
      {!isInfoItem && (
        <Checkbox
          checked={item.checked}
          onCheckedChange={handleToggle}
          disabled={loading}
          className="mt-1 h-3.5 w-3.5 rounded-sm border-muted-foreground/40 data-[state=checked]:bg-plan data-[state=checked]:border-plan"
        />
      )}
      <div className={`text-[12px] leading-snug ${item.checked ? 'line-through text-muted-foreground/60' : 'text-foreground/90'} ${isInfoItem ? 'font-bold mt-1.5 text-foreground mb-0.5 tracking-tight' : ''}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={checklistItemMdComponents}>
          {normalizedItemText}
        </ReactMarkdown>
      </div>
    </div>
  )
}

function MonthProgress({ items }: { items: PlanItem[] }) {
  const total = items.filter(i => !i.id.includes('-info-')).length
  const done = items.filter(i => !i.id.includes('-info-') && i.checked).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-1 mb-3 mt-1 p-2 px-3 rounded-lg border border-border/20 bg-elevated/20 shadow-inner">
      <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
        <span className="flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5 text-plan" />
          {done}/{total} Completed
        </span>
        <span className="text-plan">{pct}% Progress</span>
      </div>
      <div className="h-1 rounded-full bg-surface/50 overflow-hidden ring-1 ring-border/5">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_5px_rgba(244,63,94,0.3)]"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${DOMAIN_COLORS.plan.hex}, #FB923C)`,
          }}
        />
      </div>
    </div>
  )
}

function WeekProgress({ items }: { items: PlanItem[] }) {
  const total = items.filter(i => !i.id.includes('-info-')).length
  const done = items.filter(i => !i.id.includes('-info-') && i.checked).length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="space-y-1 mb-2 p-1.5 px-2.5 rounded-md border border-border/15 bg-elevated/10">
      <div className="flex justify-between items-center text-[8px] font-bold uppercase tracking-wider text-muted-foreground/70">
        <span>{done}/{total}</span>
        <span className="text-plan">{pct}%</span>
      </div>
      <div className="h-0.5 rounded-full bg-surface/50 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(to right, ${DOMAIN_COLORS.plan.hex}, #FB923C)`,
          }}
        />
      </div>
    </div>
  )
}

export default function PlanPage() {
  const [isQueueingPlanRefresh, setIsQueueingPlanRefresh] = useState(false)
  const [manualErrorCode, setManualErrorCode] = useState<string | null>(null)

  const { data: statusData, mutate: mutateStatus } = useSWR('/api/onboarding/status', fetcher, {
    refreshInterval: (data: any) => {
      const status = data?.plan?.status
      return status === 'queued' || status === 'running' ? 10000 : 0
    }
  })
  
  const { data: rawData, mutate: mutatePlan } = useSWR('/api/memory?file=plan.md', fetcher, {
    refreshInterval: (data: any) => {
      const content = typeof data?.content === 'string' ? data.content : ''
      const status = statusData?.plan?.status
      return status === 'queued' || status === 'running' || (content.includes(PLAN_PLACEHOLDER_MARKER) && status !== 'failed') ? 10000 : 0
    }
  })

  const rawContent = typeof rawData?.content === 'string' ? rawData.content : ''
  const plan = useMemo(() => rawData ? parsePlan(rawContent) : null, [rawContent, rawData])

  const planStatus: OnboardingPlanStatus | null = statusData?.plan?.status ?? null
  const planErrorCode: string | null = manualErrorCode ?? (statusData?.plan?.lastErrorCode ?? null)

  const refreshPlanStatus = useCallback(async () => {
    await mutateStatus()
    await mutatePlan()
  }, [mutateStatus, mutatePlan])

  const queuePlanRefresh = useCallback(async () => {
    setIsQueueingPlanRefresh(true)
    try {
      const res = await fetch('/api/onboarding/plan/refresh', { method: 'POST' })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        setManualErrorCode(data.error ?? 'plan_refresh_failed')
        return
      }
      setManualErrorCode(null)
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
      if (res.ok) mutatePlan()
    } catch { /* ignore */ }
  }

  if (!plan) return <div className="p-8"><div className="h-8 w-64 bg-muted animate-pulse rounded-md mb-4" /></div>

  const firstMonthValue = plan.months[0] ? `month${plan.months[0].month}` : ''
  const canRequestRefresh = planStatus !== null && planStatus !== 'queued' && planStatus !== 'running'
  const isStructured = plan.months.length > 0 || plan.immediateSteps.length > 0
  const normalizedFallbackContent = normalizeMarkdownContent(rawContent.replace(/^# .+\n{1,2}/, '').trim())

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border/20 pb-4 mb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge variant="outline" className="bg-plan/10 text-plan border-plan/20 text-[9px] font-bold h-4 px-1 uppercase tracking-wider">Roadmap</Badge>
            <PlanRoadmapBadges planStatus={planStatus} planErrorCode={planErrorCode} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{plan.title}</h1>
          <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-streak" />
            Your architected path to interview mastery
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {shouldShowPlanStatusBanner(planStatus) && (
            <PlanActionButton
              planStatus={planStatus}
              canRequestRefresh={canRequestRefresh}
              isQueueingPlanRefresh={isQueueingPlanRefresh}
              onQueuePlanRefresh={() => void queuePlanRefresh()}
            />
          )}
        </div>
      </div>

      <PlanMetadataGrid metadata={plan.metadata} />
      <PlanDashboardTable dashboard={plan.dashboard} />

      {!isStructured ? (
        <Card className="border-border/30 bg-surface p-6 sm:p-8 shadow-2xl">
          <CardContent className="p-0 [&>*:first-child]:!mt-0 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {normalizedFallbackContent}
            </ReactMarkdown>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Month Tabs */}
          {plan.months.length > 0 && (
            <Tabs defaultValue={firstMonthValue} className="w-full">
              <TabsList className="bg-elevated/50 p-0.5 rounded-lg mb-2 h-9 ring-1 ring-border/20">
                {plan.months.map(month => (
                  <TabsTrigger 
                    key={month.month} 
                    value={`month${month.month}`}
                    className="rounded-md px-4 text-xs data-[state=active]:bg-surface data-[state=active]:shadow-md data-[state=active]:text-plan"
                  >
                    Month {month.month}
                  </TabsTrigger>
                ))}
              </TabsList>

              {plan.months.map(month => {
                const allItems = Object.values(month.categories).flat()
                const hasWeeks = month.weeks && month.weeks.length > 0

                return (
                  <TabsContent key={month.month} value={`month${month.month}`} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-surface to-elevated/40 p-4 sm:p-5 shadow-lg">
                      <div className="absolute top-0 right-0 p-4 text-plan/5 -mr-5 -mt-5">
                        <Sparkles className="w-24 h-24 rotate-12" />
                      </div>
                      <div className="relative z-10">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-plan block mb-1">Focus</span>
                        <h2 className="text-lg font-bold text-foreground mb-2 sm:text-xl tracking-tight">{month.title}</h2>
                        {month.theme && (
                          <div className="flex items-start gap-2.5 p-2 px-3 rounded-lg bg-surface/80 border border-border/40 shadow-sm">
                            <Info className="h-4 w-4 text-plan shrink-0 mt-0.5" />
                            <p className="text-[12px] leading-relaxed text-muted-foreground italic">&ldquo;{month.theme}&rdquo;</p>
                          </div>
                        )}
                      </div>
                      <MonthProgress items={allItems} />
                    </div>

                    {hasWeeks ? (
                      <Tabs defaultValue={`week${month.weeks[0]?.week || 1}`}>
                        <TabsList className="bg-elevated/50 p-0.5 rounded-lg mb-3 h-8 ring-1 ring-border/20">
                          {month.weeks.map(week => (
                            <TabsTrigger
                              key={week.week}
                              value={`week${week.week}`}
                              className="rounded-md px-3 text-[11px] data-[state=active]:bg-surface data-[state=active]:shadow-md data-[state=active]:text-plan"
                            >
                              Week {week.week}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {month.weeks.map(week => {
                          const weekItems = Object.values(week.categories).flat()
                          const weekBudgets = Object.entries(week.categories)
                            .map(([cat]) => parseCategoryInfo(cat))
                            .filter(c => c.timeBudget)

                          return (
                            <TabsContent key={week.week} value={`week${week.week}`} className="space-y-3">
                              <div className="text-xs text-muted-foreground mb-1">{week.title}</div>
                              <WeekProgress items={weekItems} />

                              {weekBudgets.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-plan/15 bg-plan/5">
                                  <Clock className="h-3 w-3 text-plan/60 shrink-0" />
                                  {weekBudgets.map((b, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 text-[11px]">
                                      {i > 0 && <span className="text-plan/30 mx-0.5">·</span>}
                                      <span className="font-semibold text-plan/80">{b.name}</span>
                                      <span className="text-muted-foreground/60">{b.timeBudget}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {Object.entries(week.categories).map(([category, items]) => {
                                  const { name: categoryName } = parseCategoryInfo(category)
                                  const domain = CATEGORY_DOMAINS[categoryName] || CATEGORY_DOMAINS[Object.keys(CATEGORY_DOMAINS).find(k => categoryName.includes(k)) || ''] || 'streak'
                                  const colors = DOMAIN_COLORS[domain]

                                  return (
                                    <Card key={category} className={`overflow-hidden border border-border/20 bg-surface/60 transition-all hover:bg-surface/80 hover:shadow-lg ${categoryName.includes('Goals') ? 'md:col-span-2' : ''}`}>
                                      <CardHeader className="py-2.5 px-4 border-b border-border/10 bg-elevated/20">
                                        <CardTitle className="text-[12px] font-bold flex items-center gap-2">
                                          <div className={`p-1 rounded-md ${colors.bg} ${colors.text} shadow-sm border ${colors.border}`}>
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                          </div>
                                          <span className="truncate">{categoryName}</span>
                                          <Badge variant="outline" className="shrink-0 ml-auto text-[9px] h-5 border-border/40 bg-surface/50 font-bold tracking-tighter">
                                            {items.filter(i => !i.id.includes('-info-') && i.checked).length}/{items.filter(i => !i.id.includes('-info-')).length}
                                          </Badge>
                                        </CardTitle>
                                      </CardHeader>
                                      <CardContent className="py-2 px-4">
                                        <div className="space-y-0">
                                          {items.map(item => (
                                            <PlanCheckItem key={item.id} item={item} onToggle={handleToggle} />
                                          ))}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  )
                                })}
                              </div>
                            </TabsContent>
                          )
                        })}
                      </Tabs>
                    ) : (
                      <>
                        {(() => {
                          const monthBudgets = Object.entries(month.categories)
                            .map(([cat]) => parseCategoryInfo(cat))
                            .filter(c => c.timeBudget)
                          return monthBudgets.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border border-plan/15 bg-plan/5">
                              <Clock className="h-3 w-3 text-plan/60 shrink-0" />
                              {monthBudgets.map((b, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-[11px]">
                                  {i > 0 && <span className="text-plan/30 mx-0.5">·</span>}
                                  <span className="font-semibold text-plan/80">{b.name}</span>
                                  <span className="text-muted-foreground/60">{b.timeBudget}</span>
                                </span>
                              ))}
                            </div>
                          ) : null
                        })()}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Object.entries(month.categories).map(([category, items]) => {
                            const { name: categoryName } = parseCategoryInfo(category)
                            const domain = CATEGORY_DOMAINS[categoryName] || CATEGORY_DOMAINS[Object.keys(CATEGORY_DOMAINS).find(k => categoryName.includes(k)) || ''] || 'streak'
                            const colors = DOMAIN_COLORS[domain]

                            return (
                              <Card key={category} className={`overflow-hidden border border-border/20 bg-surface/60 transition-all hover:bg-surface/80 hover:shadow-lg ${categoryName.includes('Goals') ? 'md:col-span-2' : ''}`}>
                                <CardHeader className="py-2.5 px-4 border-b border-border/10 bg-elevated/20">
                                  <CardTitle className="text-[12px] font-bold flex items-center gap-2">
                                    <div className={`p-1 rounded-md ${colors.bg} ${colors.text} shadow-sm border ${colors.border}`}>
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="truncate">{categoryName}</span>
                                    <Badge variant="outline" className="shrink-0 ml-auto text-[9px] h-5 border-border/40 bg-surface/50 font-bold tracking-tighter">
                                      {items.filter(i => !i.id.includes('-info-') && i.checked).length}/{items.filter(i => !i.id.includes('-info-')).length}
                                    </Badge>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="py-2 px-4">
                                  <div className="space-y-0">
                                    {items.map(item => (
                                      <PlanCheckItem key={item.id} item={item} onToggle={handleToggle} />
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </TabsContent>
                )
              })}
            </Tabs>
          )}

          {/* Immediate Steps */}
          {plan.immediateSteps.length > 0 && (
            <div className="pt-2">
              <Card className="border-streak/40 bg-gradient-to-br from-streak/10 to-transparent overflow-hidden">
                <CardHeader className="py-2.5 px-4 bg-streak/5 border-b border-streak/20">
                  <CardTitle className="text-[12px] font-bold text-streak flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    Immediate Next Steps
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {plan.immediateSteps.map(item => (
                      <div key={item.id} className="p-2 rounded-lg bg-surface/50 border border-streak/10 hover:border-streak/30 transition-all">
                        <PlanCheckItem item={item} onToggle={handleToggle} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Red Flags */}
          {plan.redFlags.length > 0 && (
            <Card className="border-danger/30 bg-danger/5 shadow-xl overflow-hidden">
              <CardHeader className="py-2.5 px-4 bg-danger/10 border-b border-danger/20">
                <CardTitle className="text-[12px] font-bold text-danger flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Red Flags
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.redFlags.map((flag, i) => (
                    <div key={i} className="flex gap-2 p-3 rounded-lg border border-border/20 bg-surface hover:shadow-md transition-all border-l-2 border-l-danger">
                      <div className="space-y-1">
                        <p className="text-[12px] font-bold text-foreground leading-tight">{flag.symptom}</p>
                        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/80 leading-snug bg-elevated/40 p-2 rounded-md border border-border/10">
                          <CheckCircle2 className="h-3 w-3 mt-0.5 text-streak" />
                          <span><span className="font-bold text-streak mr-1">Fix:</span> {flag.fix}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
