'use client'

import { Card, CardContent } from '@/components/ui/card'
import { BRAND_EMOJIS } from '@/lib/brand'
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
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2.5">
              <h1 className="font-display text-2xl font-bold">{BRAND_EMOJIS.primary} Sifu Dojo</h1>
              {metrics ? (
                <span className="inline-flex shrink-0 self-start whitespace-nowrap rounded-md border border-border bg-elevated/70 px-2 py-1 text-[11px] text-muted-foreground sm:px-2.5 sm:text-xs">
                  <span className="sm:hidden">{overallPlanPct}% · {metrics.currentStreak}d</span>
                  <span className="hidden sm:inline">{overallPlanPct}% plan complete · {metrics.currentStreak} day streak</span>
                </span>
              ) : (
                <div className="h-6 w-20 animate-pulse rounded-md bg-muted/80 sm:w-44" />
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{BRAND_EMOJIS.star} Your next best interview action</p>
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
