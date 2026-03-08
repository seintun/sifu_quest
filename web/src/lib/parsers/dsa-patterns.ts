import type { MasteryLevel } from '@/lib/theme'

export interface DSAPattern {
  name: string
  mastery: MasteryLevel
  problemsSeen: number
  notes: string
}

export interface ProblemAttempt {
  problem: string
  difficulty: string
  pattern: string
  outcome: string
  date: string
  notes: string
}

export function parseDSAPatterns(content: string): DSAPattern[] {
  const patterns: DSAPattern[] = []
  const lines = content.split('\n')

  let inPatternTable = false
  let headerPassed = false

  for (const line of lines) {
    if (line.includes('| Pattern |') && line.includes('| Mastery |')) {
      inPatternTable = true
      headerPassed = false
      continue
    }
    if (inPatternTable && line.match(/^\|[-\s|]+\|$/)) {
      headerPassed = true
      continue
    }
    if (inPatternTable && headerPassed) {
      if (!line.startsWith('|')) {
        inPatternTable = false
        continue
      }
      const cells = line.split('|').map(c => c.trim()).filter(Boolean)
      if (cells.length >= 4 && cells[0] !== '—') {
        patterns.push({
          name: cells[0],
          mastery: (cells[1] as MasteryLevel) || '—',
          problemsSeen: parseInt(cells[2]) || 0,
          notes: cells[3] || '',
        })
      }
    }
  }
  return patterns
}

export function parseProblemHistory(content: string): ProblemAttempt[] {
  const attempts: ProblemAttempt[] = []
  const lines = content.split('\n')

  let inHistoryTable = false
  let headerPassed = false

  for (const line of lines) {
    if (line.includes('| Problem |') && line.includes('| Difficulty |')) {
      inHistoryTable = true
      headerPassed = false
      continue
    }
    if (inHistoryTable && line.match(/^\|[-\s|]+\|$/)) {
      headerPassed = true
      continue
    }
    if (inHistoryTable && headerPassed) {
      if (!line.startsWith('|')) {
        inHistoryTable = false
        continue
      }
      const cells = line.split('|').map(c => c.trim()).filter(Boolean)
      // Skip placeholder rows where all cells are —
      if (cells.length >= 6 && !cells.every(c => c === '—')) {
        attempts.push({
          problem: cells[0],
          difficulty: cells[1],
          pattern: cells[2],
          outcome: cells[3],
          date: cells[4],
          notes: cells[5] || '',
        })
      }
    }
  }
  return attempts
}

export function appendProblemToHistory(
  content: string,
  attempt: ProblemAttempt
): string {
  const row = `| ${attempt.problem} | ${attempt.difficulty} | ${attempt.pattern} | ${attempt.outcome} | ${attempt.date} | ${attempt.notes} |`

  // Find the placeholder row and replace it, or append after the last row
  const placeholderRegex = /\| — \| — \| — \| — \| — \| — \|/
  if (placeholderRegex.test(content)) {
    return content.replace(placeholderRegex, row)
  }

  // Find the end of the Problem History table and append
  const lines = content.split('\n')
  let lastTableRow = -1
  let inHistoryTable = false

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('| Problem |') && lines[i].includes('| Difficulty |')) {
      inHistoryTable = true
      continue
    }
    if (inHistoryTable && lines[i].startsWith('|')) {
      lastTableRow = i
    }
    if (inHistoryTable && !lines[i].startsWith('|') && lines[i].trim() !== '') {
      break
    }
  }

  if (lastTableRow !== -1) {
    lines.splice(lastTableRow + 1, 0, row)
    return lines.join('\n')
  }

  return content
}

export function updatePatternMastery(
  content: string,
  patternName: string,
  mastery: MasteryLevel,
  problemsSeen: number
): string {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|') && lines[i].includes(patternName)) {
      const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean)
      if (cells[0] === patternName) {
        cells[1] = mastery
        cells[2] = String(problemsSeen)
        lines[i] = '| ' + cells.join(' | ') + ' |'
        break
      }
    }
  }
  return lines.join('\n')
}
