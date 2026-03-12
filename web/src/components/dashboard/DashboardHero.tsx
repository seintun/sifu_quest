'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { DashboardMetrics } from '@/lib/metrics'
import { Target } from 'lucide-react'

type DashboardHeroProps = {
  metrics?: DashboardMetrics
  overallPlanPct: number
}

export function DashboardHero({ metrics, overallPlanPct }: DashboardHeroProps) {
  return (
    <section
      data-testid="dashboard-hero"
      className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-elevated/40 to-surface"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-plan/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-streak/10 blur-3xl" />
      <CardContent className="relative p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Your next best interview action</p>
            <div className="mt-3 flex items-center gap-2">
              {metrics ? (
                <span className="rounded-md border border-border bg-elevated/70 px-2.5 py-1 text-xs text-muted-foreground">
                  {overallPlanPct}% plan complete · {metrics.currentStreak} day streak
                </span>
              ) : (
                <div className="h-6 w-44 animate-pulse rounded-md bg-muted/80" />
              )}
            </div>
          </div>

          {metrics?.todayFocus && (
            <Card className="min-w-[230px] border border-streak/30 bg-streak/10">
              <CardContent className="p-4">
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
              </CardContent>
            </Card>
          )}
        </div>
      </CardContent>
    </section>
  )
}
