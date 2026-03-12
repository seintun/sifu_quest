'use client'

import { Card, CardContent } from '@/components/ui/card'
import { selectDashboardLaunchpadItems } from '@/lib/dashboard-navigation'
import { DOMAIN_COLORS } from '@/lib/theme'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

function LaunchpadCard({
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
    <Link href={href} className="group" data-testid={`quick-action-${domain}`}>
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

export function DashboardLaunchpad() {
  const primaryActions = selectDashboardLaunchpadItems(3)

  return (
    <section className="space-y-2" data-testid="dashboard-launchpad">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Start Here</h2>
        <p className="text-xs text-muted-foreground">Fastest route into high-value practice</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {primaryActions.map((action) => (
          <LaunchpadCard
            key={action.id}
            href={action.href}
            label={action.label}
            hint={action.hint}
            icon={action.icon}
            domain={action.domain}
          />
        ))}
        <Link href="/coach" className="group">
          <Card className="h-full border border-border bg-surface transition-all duration-200 hover:-translate-y-0.5">
            <CardContent className="flex h-full items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-foreground">More destinations</p>
                <p className="text-xs text-muted-foreground mt-1">Use mobile More or sidebar</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </section>
  )
}
