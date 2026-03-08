'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { DOMAIN_COLORS } from '@/lib/theme'
import type { ParsedPlan, PlanItem } from '@/lib/parsers/plan-parser'
import { parsePlan } from '@/lib/parsers/plan-parser'
import { AlertTriangle, Calendar, CheckCircle2 } from 'lucide-react'

const CATEGORY_DOMAINS: Record<string, keyof typeof DOMAIN_COLORS> = {
  DSA: 'dsa',
  'System Design': 'design',
  'Job Search': 'jobs',
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
      <span className={`text-sm ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {item.text}
      </span>
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

export default function PlanPage() {
  const [plan, setPlan] = useState<ParsedPlan | null>(null)
  const [rawContent, setRawContent] = useState('')

  const fetchPlan = useCallback(() => {
    fetch('/api/memory?file=plan.md')
      .then(res => res.json())
      .then(data => {
        setRawContent(data.content || '')
        setPlan(parsePlan(data.content || ''))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

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

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold">3-Month Plan</h1>
        <p className="text-muted-foreground text-sm mt-1">Your structured roadmap to interview success</p>
      </div>

      {/* Weekly Rhythm */}
      {plan.weeklyRhythm.length > 0 && (
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
      <Tabs defaultValue="month1">
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
