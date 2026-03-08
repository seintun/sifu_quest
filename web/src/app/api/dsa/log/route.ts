import { NextRequest, NextResponse } from 'next/server'
import { readMemoryFile, writeMemoryFile } from '@/lib/memory'
import { appendProblemToHistory, parseDSAPatterns, updatePatternMastery } from '@/lib/parsers/dsa-patterns'
import type { ProblemAttempt } from '@/lib/parsers/dsa-patterns'
import type { MasteryLevel } from '@/lib/theme'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const attempt: ProblemAttempt = await request.json()

    if (!attempt.problem || !attempt.pattern || !attempt.date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let content = await readMemoryFile('dsa-patterns.md')
    content = appendProblemToHistory(content, attempt)

    // Update pattern mastery: count problems seen for this pattern
    const patterns = parseDSAPatterns(content)
    const pattern = patterns.find(p => p.name === attempt.pattern)
    if (pattern) {
      // Auto-advance mastery based on problems seen
      const newCount = pattern.problemsSeen + 1
      let newMastery: MasteryLevel = pattern.mastery
      if (newMastery === '—') newMastery = '🔴'
      if (newCount >= 2) newMastery = '🟡'
      if (newCount >= 5) newMastery = '🟢'

      content = updatePatternMastery(content, attempt.pattern, newMastery, newCount)
    }

    await writeMemoryFile('dsa-patterns.md', content)

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
