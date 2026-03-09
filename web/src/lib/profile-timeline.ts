export interface ProfileSnapshot {
  timeline: string | null
  workspaceInitialized: string | null
}

export interface PlanTimelineMeta {
  timeline: string | null
  durationMonths: number | null
  durationYears: number | null
  prefersYearProgress: boolean
  planLabel: string
}

export interface PlanProgressMeta {
  currentMonth: number
  currentPeriodLabel: string
}

function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function computeElapsedMonths(startDate: Date, endDate: Date): number {
  let months = (endDate.getFullYear() - startDate.getFullYear()) * 12
  months += endDate.getMonth() - startDate.getMonth()

  if (endDate.getDate() < startDate.getDate()) {
    months -= 1
  }

  return Math.max(0, months)
}

function parseIsoDate(dateStr: string | null): Date | null {
  if (!dateStr) return null
  const parsed = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseProfileSnapshot(content: string): ProfileSnapshot {
  const timelineMatch = content.match(/\*\*Timeline:\*\*\s*(.+)/i)
  const startMatch = content.match(/Workspace initialized:\s*(\d{4}-\d{2}-\d{2})/i)

  return {
    timeline: timelineMatch?.[1]?.trim() || null,
    workspaceInitialized: startMatch?.[1] || null,
  }
}

export function getPlanTimelineMeta(timeline: string | null): PlanTimelineMeta {
  const trimmed = timeline?.trim() || ''

  if (!trimmed) {
    return {
      timeline: null,
      durationMonths: null,
      durationYears: null,
      prefersYearProgress: false,
      planLabel: 'Plan',
    }
  }

  const yearMatch = trimmed.match(/(\d+)\s*years?/i)
  if (yearMatch) {
    const years = parseInt(yearMatch[1], 10)
    if (years > 0) {
      return {
        timeline: trimmed,
        durationMonths: years * 12,
        durationYears: years,
        prefersYearProgress: true,
        planLabel: `${years}-Year Plan`,
      }
    }
  }

  const monthMatch = trimmed.match(/(\d+)\s*months?/i)
  if (monthMatch) {
    const months = parseInt(monthMatch[1], 10)
    if (months > 0) {
      return {
        timeline: trimmed,
        durationMonths: months,
        durationYears: null,
        prefersYearProgress: false,
        planLabel: `${months}-Month Plan`,
      }
    }
  }

  if (trimmed.toLowerCase().includes('actively interviewing')) {
    return {
      timeline: trimmed,
      durationMonths: null,
      durationYears: null,
      prefersYearProgress: false,
      planLabel: 'Active Interview Plan',
    }
  }

  if (trimmed.toLowerCase().includes('no hard deadline')) {
    return {
      timeline: trimmed,
      durationMonths: null,
      durationYears: null,
      prefersYearProgress: false,
      planLabel: 'Long-Term Plan',
    }
  }

  return {
    timeline: trimmed,
    durationMonths: null,
    durationYears: null,
    prefersYearProgress: false,
    planLabel: `${toTitleCase(trimmed)} Plan`,
  }
}

export function getPlanProgressMeta(
  timelineMeta: PlanTimelineMeta,
  workspaceInitialized: string | null,
  now = new Date()
): PlanProgressMeta {
  const startDate = parseIsoDate(workspaceInitialized) || now
  const elapsedMonths = computeElapsedMonths(startDate, now)
  const unconstrainedMonth = Math.max(1, elapsedMonths + 1)

  const currentMonth = timelineMeta.durationMonths
    ? Math.min(unconstrainedMonth, timelineMeta.durationMonths)
    : unconstrainedMonth

  if (timelineMeta.prefersYearProgress && timelineMeta.durationYears) {
    const currentYear = Math.min(
      Math.floor((currentMonth - 1) / 12) + 1,
      timelineMeta.durationYears
    )
    const withTotal = timelineMeta.durationYears > 1
      ? `Year ${currentYear} of ${timelineMeta.durationYears}`
      : `Year ${currentYear}`

    return {
      currentMonth,
      currentPeriodLabel: withTotal,
    }
  }

  const withTotal = timelineMeta.durationMonths
    ? `Month ${currentMonth} of ${timelineMeta.durationMonths}`
    : `Month ${currentMonth}`

  return {
    currentMonth,
    currentPeriodLabel: withTotal,
  }
}
