'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { DOMAIN_COLORS } from '@/lib/theme'
import type { ParsedPlan, PlanItem } from '@/lib/parsers/plan-parser'
import { parsePlan } from '@/lib/parsers/plan-parser'
import { AlertTriangle, Calendar, CheckCircle2, ChevronRight, Info } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-xl font-display font-bold text-foreground mb-4">{children}</h1>,
  h2: ({ children }) => (
    <div className="flex items-center gap-2 mt-8 mb-3 px-3 py-2 rounded-lg border border-plan/30 bg-plan/5">
      <ChevronRight className="h-3.5 w-3.5 opacity-50 shrink-0" />
      <h2 className="text-sm font-display font-semibold text-foreground tracking-wide">{children}</h2>
    </div>
  ),
  h3: ({ children }) => <h3 className="text-xs font-display font-semibold text-foreground/60 uppercase tracking-wider mt-5 mb-2 ml-1">{children}</h3>,
  blockquote: ({ children }) => (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 my-3 rounded-lg bg-coach/5 border border-coach/20">
      <Info className="h-3.5 w-3.5 text-coach shrink-0 mt-0.5" />
      <div className="text-[13px] text-foreground/50 leading-relaxed [&_p]:my-0">{children}</div>
    </div>
  ),
  p: ({ children }) => <p className="text-[13px] text-foreground/75 my-1.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="space-y-1.5 my-2 ml-1">{children}</ul>,
  ol: ({ children }) => <ol className="space-y-1.5 my-2 ml-1 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <li className="text-[13px] text-foreground/75 leading-relaxed flex items-start gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-foreground/20 mt-[7px] shrink-0" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-plan hover:underline underline-offset-2">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="my-3 rounded-lg border border-border/40 overflow-hidden">
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-elevated/60">{children}</thead>,
  th: ({ children }) => <th className="text-left text-[11px] uppercase tracking-wider font-medium py-2.5 px-3 text-foreground/50 border-b border-border/50">{children}</th>,
  td: ({ children }) => <td className="py-2 px-3 text-foreground/70 border-b border-border/15 text-[13px]">{children}</td>,
  tr: ({ children }) => <tr className="transition-colors hover:bg-elevated/20">{children}</tr>,
  hr: () => <div className="my-4" />,
}

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

function extractTitle(content: string): string {
  const match = content.match(/^# (.+)/m)
  return match ? match[1].trim() : 'My Plan'
}

function hasStructuredContent(plan: ParsedPlan): boolean {
  return plan.months.length > 0 || plan.immediateSteps.length > 0 || plan.weeklyRhythm.length > 0
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

  const title = extractTitle(rawContent)

  // AI-generated plan: fall back to markdown rendering
  if (!hasStructuredContent(plan)) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground text-sm mt-1">Your personalized roadmap</p>
        </div>
        {rawContent ? (
          <Card className="border-border bg-surface">
            <CardContent className="px-6 py-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {rawContent}
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
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
