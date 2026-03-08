'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProblemAttempt } from '@/lib/parsers/dsa-patterns'
import { parseProblemHistory } from '@/lib/parsers/dsa-patterns'
import type { JobApplication } from '@/lib/parsers/job-search'
import { parseJobApplications } from '@/lib/parsers/job-search'
import type { SystemDesignConcept } from '@/lib/parsers/system-design'
import { parseSystemDesign } from '@/lib/parsers/system-design'
import { cn } from '@/lib/utils'
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay,
    isSameDay,
    isSameMonth,
    isToday,
    startOfMonth,
    subMonths,
} from 'date-fns'
import { ArrowRight, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Flame } from 'lucide-react'
import { useEffect, useState } from 'react'

interface DayActivity {
  date: Date
  dsa: number
  jobs: number
  design: number
  dsaEntries: string[]
  jobEntries: string[]
  designEntries: string[]
}

function emptyActivity(date: Date): DayActivity {
  return { date, dsa: 0, jobs: 0, design: 0, dsaEntries: [], jobEntries: [], designEntries: [] }
}

function totalActivity(a: DayActivity): number {
  return a.dsa + a.jobs + a.design
}

/** Returns a Tailwind opacity class based on activity intensity */
function intensityClass(count: number): string {
  if (count === 0) return ''
  if (count === 1) return 'bg-foreground/5'
  if (count === 2) return 'bg-foreground/10'
  return 'bg-foreground/[0.15]'
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [activities, setActivities] = useState<Map<string, DayActivity>>(new Map())
  const [selectedDay, setSelectedDay] = useState<DayActivity | null>(null)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    Promise.all([
      fetch('/api/memory?file=dsa-patterns.md').then(r => r.json()),
      fetch('/api/memory?file=job-search.md').then(r => r.json()),
      fetch('/api/memory?file=system-design.md').then(r => r.json()),
    ]).then(([dsaData, jobData, sdData]) => {
      const problems: ProblemAttempt[] = parseProblemHistory(dsaData.content || '')
      const apps: JobApplication[] = parseJobApplications(jobData.content || '')
      const sdParsed = parseSystemDesign(sdData.content || '')
      const concepts: SystemDesignConcept[] = sdParsed.concepts

      const actMap = new Map<string, DayActivity>()

      for (const p of problems) {
        if (p.date && p.date !== '—') {
          const key = p.date
          const existing = actMap.get(key) || emptyActivity(new Date(key))
          existing.dsa++
          existing.dsaEntries.push(p.problem)
          actMap.set(key, existing)
        }
      }

      for (const a of apps) {
        if (a.dateApplied && a.dateApplied !== '—') {
          const key = a.dateApplied
          const existing = actMap.get(key) || emptyActivity(new Date(key))
          existing.jobs++
          existing.jobEntries.push(`${a.company} — ${a.role}`)
          actMap.set(key, existing)
        }
      }

      for (const c of concepts) {
        if (c.date && c.date !== '—') {
          const key = c.date
          const existing = actMap.get(key) || emptyActivity(new Date(key))
          existing.design++
          existing.designEntries.push(c.concept)
          actMap.set(key, existing)
        }
      }

      setActivities(actMap)

      // Compute streak
      const allDates = [...actMap.keys()].sort().reverse()
      let s = 0
      const today = new Date()
      const check = new Date(today)
      check.setHours(0, 0, 0, 0)

      for (let i = 0; i < 365; i++) {
        const dateStr = check.toISOString().split('T')[0]
        if (allDates.includes(dateStr)) {
          s++
          check.setDate(check.getDate() - 1)
        } else if (i === 0) {
          check.setDate(check.getDate() - 1)
        } else {
          break
        }
      }
      setStreak(s)
    }).catch(() => {})
  }, [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDayOfWeek = getDay(monthStart)
  const isCurrentMonth = isSameMonth(currentMonth, new Date())

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Calendar</h1>
          <p className="text-muted-foreground text-sm mt-1">Activity tracker</p>
        </div>

        {/* Streak Counter */}
        <Card className="bg-streak/10 border border-streak/30">
          <CardContent className="p-3 flex items-center gap-2">
            <Flame className="h-5 w-5 text-streak" />
            <span className={cn(
              "text-3xl font-display font-bold tabular-nums",
              streak >= 7 ? "text-streak animate-streak-glow" : "text-foreground"
            )}>
              {streak}
            </span>
            <span className="text-xs text-muted-foreground">day streak</span>
          </CardContent>
        </Card>
      </div>

      {/* Month Navigation */}
      <Card className="border-border bg-surface">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-streak" />
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              {!isCurrentMonth && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 px-2 gap-1"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs text-dim font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {days.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const activity = activities.get(dateKey)
              const today = isToday(day)
              const selected = selectedDay && isSameDay(day, selectedDay.date)
              const count = activity ? totalActivity(activity) : 0

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDay(activity || emptyActivity(day))}
                  className={cn(
                    'aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 text-xs transition-colors relative',
                    today ? 'ring-1 ring-streak/50' : '',
                    selected ? 'bg-elevated' : intensityClass(count),
                    !selected && 'hover:bg-elevated/50',
                  )}
                >
                  <span className={cn(
                    'tabular-nums',
                    today ? 'text-streak font-medium' : 'text-muted-foreground'
                  )}>
                    {format(day, 'd')}
                  </span>
                  {activity && (
                    <div className="flex gap-0.5">
                      {activity.dsa > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-dsa inline-block" />
                      )}
                      {activity.jobs > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-jobs inline-block" />
                      )}
                      {activity.design > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-design inline-block" />
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-dsa" />
              DSA Problems
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-jobs" />
              Job Applications
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-design" />
              System Design
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Detail */}
      {selectedDay && (
        <Card className="border-border bg-surface animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalActivity(selectedDay) === 0 ? (
              <p className="text-muted-foreground text-sm">No activity logged for this day.</p>
            ) : (
              <div className="space-y-3">
                {/* DSA entries */}
                {selectedDay.dsa > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-dsa" />
                      <span className="text-sm font-medium text-dsa">
                        {selectedDay.dsa} DSA problem{selectedDay.dsa !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ul className="ml-4 space-y-0.5">
                      {selectedDay.dsaEntries.map((entry, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {entry}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Job entries */}
                {selectedDay.jobs > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-jobs" />
                      <span className="text-sm font-medium text-jobs">
                        {selectedDay.jobs} application{selectedDay.jobs !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ul className="ml-4 space-y-0.5">
                      {selectedDay.jobEntries.map((entry, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {entry}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* System Design entries */}
                {selectedDay.design > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full bg-design" />
                      <span className="text-sm font-medium text-design">
                        {selectedDay.design} concept{selectedDay.design !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <ul className="ml-4 space-y-0.5">
                      {selectedDay.designEntries.map((entry, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {entry}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
