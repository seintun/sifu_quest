'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DOMAIN_COLORS } from '@/lib/theme'
import type { DashboardMetrics } from '@/lib/metrics'
import { ArrowRight, Briefcase, Calendar, CheckCircle2, Code2, Flame, Network } from 'lucide-react'
import Link from 'next/link'

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
    <Card data-testid={`metric-card-${domain}`} className={`h-full ${colors.bg} border ${colors.border} ${colors.glow} transition-all duration-200 hover:-translate-y-0.5`}>
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={`mt-0.5 text-lg sm:text-xl font-display font-bold leading-tight ${colors.text}`}>{value}</p>
            {subtitle && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          <span className={`inline-flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-md border ${colors.border} ${colors.bg}`}>
            <Icon className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${colors.text} opacity-80`} />
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

type DashboardProgressProps = {
  metrics?: DashboardMetrics
  planLabel: string
}

export function DashboardProgress({ metrics, planLabel }: DashboardProgressProps) {
  const dsaMasteryPct = (metrics?.dsaPatternsTotal ?? 0) > 0
    ? Math.round(((metrics?.dsaPatternsMastered ?? 0) / (metrics?.dsaPatternsTotal ?? 1)) * 100)
    : 0

  const applicationsSummary = Object.entries(metrics?.jobApplicationsByStatus ?? {})
    .map(([status, count]) => `${count} ${status}`)
    .join(', ') || 'No pipeline yet'

  return (
    <section className="space-y-2.5 sm:space-y-3" data-testid="dashboard-progress">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2.5 sm:gap-3">
        <Card className="xl:col-span-2 border border-border bg-surface">
          <CardHeader className="border-b border-border/40 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-plan" />
                {planLabel} Progress
              </CardTitle>
              <Link href="/plan" className="inline-flex items-center gap-1 text-xs font-medium text-plan hover:text-plan/80 transition-colors">
                Open Plan
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-4 py-3.5">
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
          </CardContent>
        </Card>

        <Card className="border border-border bg-surface">
          <CardHeader className="border-b border-border/40 px-4 py-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-streak" />
              Weekly Rhythm
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-3.5">
            {(metrics?.weeklyRhythm?.length ?? 0) > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {metrics?.weeklyRhythm?.map((entry) => {
                  const isToday = metrics?.todayFocus?.day === entry.day
                  return (
                    <div
                      key={entry.day}
                      className={cn(
                        'rounded-lg border p-1.5 text-xs',
                        isToday
                          ? 'border-streak/40 bg-streak/10 text-streak'
                          : 'border-border/50 bg-elevated/40 text-muted-foreground',
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
    </section>
  )
}
