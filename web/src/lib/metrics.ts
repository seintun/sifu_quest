import { getDay } from 'date-fns'
import { readMemoryFiles } from './memory.ts'
import { createAdminClient } from './supabase-admin.ts'
import { parseDSAPatterns, parseProblemHistory } from './parsers/dsa-patterns.ts'
import { parseJobApplications } from './parsers/job-search.ts'
import { parsePlan } from './parsers/plan-parser.ts'
import { parseSystemDesign } from './parsers/system-design.ts'
import { getPlanProgressMeta, getPlanTimelineMeta, parseProfileSnapshot } from './profile-timeline.ts'
import { computeStreak } from './streak.ts'

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
  const memoryFiles = await readMemoryFiles(userId, [
    'dsa-patterns.md',
    'job-search.md',
    'plan.md',
    'system-design.md',
    'profile.md',
  ])
  const dsaContent = memoryFiles['dsa-patterns.md'] ?? ''
  const jobContent = memoryFiles['job-search.md'] ?? ''
  const planContent = memoryFiles['plan.md'] ?? ''
  const sysDesignContent = memoryFiles['system-design.md'] ?? ''
  const profileContent = memoryFiles['profile.md'] ?? ''

  // DSA metrics
  const patterns = parseDSAPatterns(dsaContent) || []
  const problems = parseProblemHistory(dsaContent) || []

  const dsaPatternsTotal = patterns.length ?? 0
  const dsaPatternsMastered = patterns.filter(p => p.mastery === '🟢').length ?? 0
  const dsaPatternsInProgress = patterns.filter(p => p.mastery === '🟡').length ?? 0

  // Job metrics
  const applications = parseJobApplications(jobContent) || []
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
  const todayFocus = (plan.weeklyRhythm ?? []).find(r =>
    r.day.toLowerCase() === todayName.toLowerCase()
  ) || null

  const lookbackDate = new Date()
  lookbackDate.setUTCHours(0, 0, 0, 0)
  lookbackDate.setUTCDate(lookbackDate.getUTCDate() - 366)

  // Calculate current streak from progress_events
  const supabase = createAdminClient()
  const eventDates = await fetchProgressEventDays(userId, lookbackDate.toISOString(), supabase)

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
    dsaPatternsTotal: dsaPatternsTotal ?? 0,
    dsaPatternsMastered: dsaPatternsMastered ?? 0,
    dsaPatternsInProgress: dsaPatternsInProgress ?? 0,
    dsaProblemsCompleted: problems.length ?? 0,
    jobApplicationsTotal: applications.length ?? 0,
    jobApplicationsByStatus: jobApplicationsByStatus ?? {},
    systemDesignConceptsCovered: sysDesign.concepts?.length ?? 0,
    planItemsTotal: planItemsTotal ?? 0,
    planItemsCompleted: planItemsCompleted ?? 0,
    currentStreak: currentStreak ?? 0,
    todayFocus,
    weeklyRhythm: plan.weeklyRhythm ?? [],
    planLabel: timelineMeta.planLabel || 'Plan',
    currentMonth: progressMeta.currentMonth ?? 1,
    currentPlanPeriodLabel: progressMeta.currentPeriodLabel || 'Month 1',
  }
}

type SupabaseAdminClient = ReturnType<typeof createAdminClient>

async function fetchProgressEventDays(
  userId: string,
  fromIso: string,
  supabase: SupabaseAdminClient,
): Promise<string[]> {
  const rpcResult = await supabase.rpc('list_progress_event_days', {
    user_id_param: userId,
    from_iso_param: fromIso,
  })

  if (!rpcResult.error && Array.isArray(rpcResult.data)) {
    return rpcResult.data
      .map((entry: { day?: string } | null) => entry?.day ?? '')
      .filter((day) => Boolean(day))
  }

  const { data: events } = await supabase
    .from('progress_events')
    .select('occurred_at')
    .eq('user_id', userId)
    .gte('occurred_at', fromIso)

  const uniqueDays = new Set<string>()
  for (const event of events || []) {
    if (!event?.occurred_at) continue
    uniqueDays.add(new Date(event.occurred_at).toISOString().split('T')[0])
  }

  return [...uniqueDays]
}
