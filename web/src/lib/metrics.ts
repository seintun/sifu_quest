import { getDay } from 'date-fns'
import { readMemoryFile } from './memory'
import { parseDSAPatterns, parseProblemHistory } from './parsers/dsa-patterns'
import { parseJobApplications } from './parsers/job-search'
import { parsePlan } from './parsers/plan-parser'
import { parseSystemDesign } from './parsers/system-design'
import { getPlanProgressMeta, getPlanTimelineMeta, parseProfileSnapshot } from './profile-timeline'

export interface DashboardMetrics {
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

export async function computeMetrics(userId: string): Promise<DashboardMetrics> {
  const [dsaContent, jobContent, planContent, sysDesignContent, profileContent] = await Promise.all([
    readMemoryFile(userId, 'dsa-patterns.md'),
    readMemoryFile(userId, 'job-search.md'),
    readMemoryFile(userId, 'plan.md'),
    readMemoryFile(userId, 'system-design.md'),
    readMemoryFile(userId, 'profile.md'),
  ])

  // DSA metrics
  const patterns = parseDSAPatterns(dsaContent)
  const problems = parseProblemHistory(dsaContent)

  const dsaPatternsTotal = patterns.length
  const dsaPatternsMastered = patterns.filter(p => p.mastery === '🟢').length
  const dsaPatternsInProgress = patterns.filter(p => p.mastery === '🟡').length

  // Job metrics
  const applications = parseJobApplications(jobContent)
  const jobApplicationsByStatus: Record<string, number> = {}
  for (const app of applications) {
    jobApplicationsByStatus[app.status] = (jobApplicationsByStatus[app.status] || 0) + 1
  }

  // Plan metrics
  const plan = parsePlan(planContent)
  let planItemsTotal = 0
  let planItemsCompleted = 0
  for (const month of plan.months) {
    for (const items of Object.values(month.categories)) {
      planItemsTotal += items.length
      planItemsCompleted += items.filter(item => item.checked).length
    }
  }
  planItemsTotal += plan.immediateSteps.length
  planItemsCompleted += plan.immediateSteps.filter(item => item.checked).length

  // System design metrics
  const sysDesign = parseSystemDesign(sysDesignContent)

  // Today's focus from weekly rhythm
  const dayIndex = getDay(new Date()) // 0=Sunday, 1=Monday, ...
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayName = dayNames[dayIndex]
  const todayFocus = plan.weeklyRhythm.find(r =>
    r.day.toLowerCase() === todayName.toLowerCase()
  ) || null

  // Calculate current streak from progress_events
  const supabase = await import('./supabase').then(m => m.createClient())
  const db = await supabase
  const { data: events } = await db
    .from('progress_events')
    .select('occurred_at')
    .eq('user_id', userId)

  const eventDates = (events || []).map(e => {
    // occurred_at is a TIMESTAMPTZ, so convert to YYYY-MM-DD
    return new Date(e.occurred_at).toISOString().split('T')[0]
  })

  // We should also include any dates parsed from files *before* the DB migration
  // to preserve old streaks, combining them into one Set
  const legacyDates = [
    ...problems.map(p => p.date),
    ...applications.map(a => a.dateApplied || ''),
    ...sysDesign.concepts.map(c => c.date || '')
  ].filter(d => Boolean(d) && d !== '—')

  const currentStreak = computeStreak([...legacyDates, ...eventDates])

  // Timeline-driven plan labels/progress from profile metadata
  const profile = parseProfileSnapshot(profileContent)
  const timelineMeta = getPlanTimelineMeta(profile.timeline)
  const progressMeta = getPlanProgressMeta(timelineMeta, profile.workspaceInitialized)

  return {
    dsaPatternsTotal,
    dsaPatternsMastered,
    dsaPatternsInProgress,
    dsaProblemsCompleted: problems.length,
    jobApplicationsTotal: applications.length,
    jobApplicationsByStatus,
    systemDesignConceptsCovered: sysDesign.concepts.length,
    planItemsTotal,
    planItemsCompleted,
    currentStreak,
    todayFocus,
    weeklyRhythm: plan.weeklyRhythm,
    planLabel: timelineMeta.planLabel,
    currentMonth: progressMeta.currentMonth,
    currentPlanPeriodLabel: progressMeta.currentPeriodLabel,
  }
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0

  const uniqueDates = [...new Set(dates)].sort().reverse()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  const checkDate = new Date(today)

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0]
    if (uniqueDates.includes(dateStr)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (i === 0) {
      // Today hasn't been logged yet, check from yesterday
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}
