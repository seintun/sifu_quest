import { readMemoryFile, writeMemoryFile } from '@/lib/memory'
import type { ProblemAttempt } from '@/lib/parsers/dsa-patterns'
import { appendProblemToHistory, parseDSAPatterns, updatePatternMastery } from '@/lib/parsers/dsa-patterns'
import { logAuditEvent, logProgressEvent } from '@/lib/progress'
import type { MasteryLevel } from '@/lib/theme'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const attempt: ProblemAttempt = await request.json()

    if (!attempt.problem || !attempt.pattern || !attempt.date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let content = await readMemoryFile(userId, 'dsa-patterns.md')
    content = appendProblemToHistory(content, attempt)

    // Update pattern mastery: count problems seen for this pattern
    const patterns = parseDSAPatterns(content)
    const pattern = patterns.find(p => p.name === attempt.pattern)
    let newMastery: MasteryLevel | undefined
    if (pattern) {
      // Auto-advance mastery based on problems seen
      const newCount = pattern.problemsSeen + 1
      newMastery = pattern.mastery
      if (newMastery === '—') newMastery = '🔴'
      if (newCount >= 2) newMastery = '🟡'
      if (newCount >= 5) newMastery = '🟢'

      content = updatePatternMastery(content, attempt.pattern, newMastery, newCount)
    }

    await writeMemoryFile(userId, 'dsa-patterns.md', content, 'dsa_log')

    // Fire progress event for metrics
    await logProgressEvent(userId, 'dsa_problem_logged', 'dsa', attempt)
    await logAuditEvent(userId, 'update_memory', 'dsa-patterns.md', { action: 'logged_problem', problem: attempt.problem })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

