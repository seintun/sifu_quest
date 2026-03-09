'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DOMAIN_COLORS } from '@/lib/theme'
import {
  Code2,
  Briefcase,
  Network,
  Target,
  Flame,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'

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
  currentMonth: number
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
    <Card className={`${colors.bg} border ${colors.border} ${colors.glow} transition-all duration-200`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={`text-2xl font-display font-bold mt-1 ${colors.text}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Icon className={`h-5 w-5 ${colors.text} opacity-60`} />
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your job search at a glance</p>
      </div>

      {/* Today's Focus */}
      {metrics.todayFocus && (
        <Card className="bg-streak/10 border border-streak/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-streak" />
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Today&apos;s Focus</p>
                <p className="text-lg font-display font-semibold text-streak">{metrics.todayFocus.focus}</p>
                <p className="text-sm text-muted-foreground">{metrics.todayFocus.time}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="DSA Problems"
          value={metrics.dsaProblemsCompleted}
          subtitle={`${metrics.dsaPatternsMastered}/${metrics.dsaPatternsTotal} patterns mastered`}
          icon={Code2}
          domain="dsa"
        />
        <MetricCard
          title="Applications"
          value={metrics.jobApplicationsTotal}
          subtitle={Object.entries(metrics.jobApplicationsByStatus ?? {}).map(([k, v]) => `${v} ${k}`).join(', ') || 'None yet'}
          icon={Briefcase}
          domain="jobs"
        />
        <MetricCard
          title="System Design"
          value={metrics.systemDesignConceptsCovered}
          subtitle="concepts covered"
          icon={Network}
          domain="design"
        />
        <MetricCard
          title="Streak"
          value={`${metrics.currentStreak} days`}
          icon={Flame}
          domain="streak"
        />
      </div>

      {/* Progress Bars */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-plan" />
            3-Month Plan Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressBar
            label="Overall Plan"
            current={metrics.planItemsCompleted}
            total={metrics.planItemsTotal}
            startHex={DOMAIN_COLORS.plan.hex}
            endHex="#FB923C"
          />
          <ProgressBar
            label="DSA Patterns"
            current={metrics.dsaPatternsMastered}
            total={metrics.dsaPatternsTotal}
            startHex={DOMAIN_COLORS.dsa.hex}
            endHex={DOMAIN_COLORS.design.hex}
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/dsa">
          <Card className="border-border bg-surface hover:border-dsa/30 hover:shadow-glow-dsa transition-all duration-200 cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-dsa" />
                <span className="text-sm">Practice DSA</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/jobs">
          <Card className="border-border bg-surface hover:border-jobs/30 hover:shadow-glow-jobs transition-all duration-200 cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-jobs" />
                <span className="text-sm">Log Applications</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/plan">
          <Card className="border-border bg-surface hover:border-plan/30 hover:shadow-glow-plan transition-all duration-200 cursor-pointer">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-plan border-plan/30">Month {metrics.currentMonth}</Badge>
                <span className="text-sm">View Plan</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Weekly Rhythm */}
      {metrics.weeklyRhythm.length > 0 && (
        <Card className="border-border bg-surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Weekly Rhythm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {metrics.weeklyRhythm.map(entry => {
                const isToday = metrics.todayFocus?.day === entry.day
                return (
                  <div
                    key={entry.day}
                    className={`rounded-md p-2 text-center text-xs ${
                      isToday
                        ? 'bg-streak/10 border border-streak/30 text-streak'
                        : 'bg-elevated text-muted-foreground'
                    }`}
                  >
                    <p className="font-medium">{entry.day}</p>
                    <p className="mt-0.5 truncate">{entry.focus}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
