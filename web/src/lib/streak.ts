function toUtcDayString(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0

  const uniqueDates = new Set(dates)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  let streak = 0
  const checkDate = new Date(today)

  for (let i = 0; i < 365; i++) {
    const dateStr = toUtcDayString(checkDate)
    if (uniqueDates.has(dateStr)) {
      streak++
      checkDate.setUTCDate(checkDate.getUTCDate() - 1)
    } else if (i === 0) {
      checkDate.setUTCDate(checkDate.getUTCDate() - 1)
    } else {
      break
    }
  }

  return streak
}
