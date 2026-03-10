'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DOMAIN_COLORS } from '@/lib/theme'
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
  Target,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

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
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)

  useEffect(() => {
    fetch('/api/progress')
      .then(res => res.json())
      .then(setMetrics)
      .catch(() => {})
  }, [])

  if (!metrics) {
    return <div className="text-muted-foreground">Loading dashboard...</div>
  }

  const planHref = '/plan'
  const planLabel = metrics.planLabel || 'Active Interview Plan'
  const overallPlanPct = metrics.planItemsTotal > 0
    ? Math.round((metrics.planItemsCompleted / metrics.planItemsTotal) * 100)
    : 0
  const dsaMasteryPct = metrics.dsaPatternsTotal > 0
    ? Math.round((metrics.dsaPatternsMastered / metrics.dsaPatternsTotal) * 100)
    : 0
  const applicationsSummary = Object.entries(metrics.jobApplicationsByStatus ?? {})
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
  ]

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
                <span className="rounded-md border border-plan/30 bg-plan/10 px-2.5 py-1 text-xs font-medium text-plan">
                  {planLabel}
                </span>
                <span className="rounded-md border border-border bg-elevated/70 px-2.5 py-1 text-xs text-muted-foreground">
                  {overallPlanPct}% complete
                </span>
                <span className="rounded-md border border-border bg-elevated/70 px-2.5 py-1 text-xs text-muted-foreground">
                  {metrics.currentStreak ?? 0} day streak
                </span>
              </div>
            </div>

            {metrics.todayFocus && (
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

      {/* Metrics Grid */}
      <div className="max-h-[33vh] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
          <MetricCard
            title="DSA Problems"
            value={metrics.dsaProblemsCompleted ?? 0}
            subtitle={`${metrics.dsaPatternsMastered ?? 0}/${metrics.dsaPatternsTotal ?? 0} patterns mastered (${dsaMasteryPct}%)`}
            icon={Code2}
            domain="dsa"
          />
          <MetricCard
            title="Applications"
            value={metrics.jobApplicationsTotal ?? 0}
            subtitle={applicationsSummary}
            icon={Briefcase}
            domain="jobs"
          />
          <MetricCard
            title="System Design"
            value={metrics.systemDesignConceptsCovered ?? 0}
            subtitle="concepts covered"
            icon={Network}
            domain="design"
          />
          <MetricCard
            title="Streak"
            value={`${metrics.currentStreak ?? 0} days`}
            icon={Flame}
            domain="streak"
          />
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
            <ProgressBar
              label="Overall Plan"
              current={metrics.planItemsCompleted ?? 0}
              total={metrics.planItemsTotal ?? 0}
              startHex={DOMAIN_COLORS.plan.hex}
              endHex="#FB923C"
            />
            <ProgressBar
              label="DSA Patterns"
              current={metrics.dsaPatternsMastered ?? 0}
              total={metrics.dsaPatternsTotal ?? 0}
              startHex={DOMAIN_COLORS.dsa.hex}
              endHex={DOMAIN_COLORS.design.hex}
            />
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
            {metrics.weeklyRhythm?.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {metrics.weeklyRhythm.map(entry => {
                  const isToday = metrics.todayFocus?.day === entry.day
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
