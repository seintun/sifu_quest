export interface PlanItem {
  id: string
  text: string
  checked: boolean
  category: string
  month: number
  week: number | null
  lineIndex: number
}

export interface WeeklyRhythmEntry {
  day: string
  focus: string
  time: string
}

export interface MonthSection {
  month: number
  title: string
  theme: string
  categories: Record<string, PlanItem[]>
}

export interface ParsedPlan {
  weeklyRhythm: WeeklyRhythmEntry[]
  months: MonthSection[]
  redFlags: Array<{ symptom: string; fix: string }>
  immediateSteps: PlanItem[]
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function parsePlan(content: string): ParsedPlan {
  const lines = content.split('\n')
  const weeklyRhythm: WeeklyRhythmEntry[] = []
  const months: MonthSection[] = []
  const redFlags: Array<{ symptom: string; fix: string }> = []
  const immediateSteps: PlanItem[] = []

  let currentMonth: MonthSection | null = null
  let currentCategory = ''
  let currentSection = ''
  let itemCounters: Record<string, number> = {}

  // Parse Weekly Rhythm table
  let inRhythmTable = false
  let rhythmHeaderPassed = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Weekly Rhythm table
    if (line.includes('| Day |') && line.includes('| Focus |')) {
      inRhythmTable = true
      rhythmHeaderPassed = false
      continue
    }
    if (inRhythmTable && line.match(/^\|[-\s|]+\|$/)) {
      rhythmHeaderPassed = true
      continue
    }
    if (inRhythmTable && rhythmHeaderPassed) {
      if (!line.startsWith('|')) {
        inRhythmTable = false
      } else {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean)
        if (cells.length >= 3) {
          weeklyRhythm.push({ day: cells[0], focus: cells[1], time: cells[2] })
        }
        continue
      }
    }

    // Month headers: ## Month N —
    const monthMatch = line.match(/^## Month (\d+)\s*[—–-]\s*(.+)\((\w+)\)/)
    if (monthMatch) {
      currentMonth = {
        month: parseInt(monthMatch[1]),
        title: monthMatch[2].trim(),
        theme: '',
        categories: {},
      }
      months.push(currentMonth)
      currentCategory = ''
      itemCounters = {}
      currentSection = 'month'
      continue
    }

    // Theme line
    if (currentMonth && line.startsWith('**Theme:')) {
      currentMonth.theme = line.replace(/\*\*/g, '').replace('Theme:', '').trim()
      continue
    }

    // Category headers (### DSA, ### System Design, ### Job Search)
    const catMatch = line.match(/^### (.+)/)
    if (catMatch && currentSection === 'month') {
      currentCategory = catMatch[1].trim()
      if (currentMonth) {
        currentMonth.categories[currentCategory] = []
      }
      continue
    }

    // Red Flags section
    if (line.includes('## Red Flags')) {
      currentSection = 'redflags'
      currentMonth = null
      continue
    }

    // Red Flags table
    if (currentSection === 'redflags' && line.startsWith('|') && !line.includes('| Symptom |') && !line.match(/^\|[-\s|]+\|$/)) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean)
      if (cells.length >= 2) {
        redFlags.push({ symptom: cells[0], fix: cells[1] })
      }
      continue
    }

    // Immediate Next Steps
    if (line.includes('## Immediate Next Steps')) {
      currentSection = 'immediate'
      currentMonth = null
      continue
    }

    // Checklist items (- [ ] or - [x])
    const checkMatch = line.match(/^- \[([ x])\] (.+)/)
    if (checkMatch) {
      const checked = checkMatch[1] === 'x'
      const text = checkMatch[2].trim()

      // Extract week from text if present
      const weekMatch = text.match(/^Week (\d+):/)
      const week = weekMatch ? parseInt(weekMatch[1]) : null

      if (currentSection === 'immediate') {
        const id = `immediate-${immediateSteps.length}`
        immediateSteps.push({
          id,
          text,
          checked,
          category: 'Immediate',
          month: 0,
          week: null,
          lineIndex: i,
        })
      } else if (currentMonth && currentCategory) {
        const categorySlug = slugify(currentCategory)
        const counterKey = `month${currentMonth.month}-${categorySlug}`
        if (!itemCounters[counterKey]) itemCounters[counterKey] = 0
        const index = itemCounters[counterKey]++

        const weekPart = week ? `-week${week}` : ''
        const id = `month${currentMonth.month}-${categorySlug}${weekPart}-${index}`

        const item: PlanItem = {
          id,
          text,
          checked,
          category: currentCategory,
          month: currentMonth.month,
          week,
          lineIndex: i,
        }

        if (!currentMonth.categories[currentCategory]) {
          currentMonth.categories[currentCategory] = []
        }
        currentMonth.categories[currentCategory].push(item)
      }
    }
  }

  return { weeklyRhythm, months, redFlags, immediateSteps }
}

export function togglePlanItem(content: string, itemId: string, checked: boolean): string {
  const parsed = parsePlan(content)

  // Find the item by ID across all sections
  let targetItem: PlanItem | undefined

  for (const month of parsed.months) {
    for (const items of Object.values(month.categories)) {
      targetItem = items.find(item => item.id === itemId)
      if (targetItem) break
    }
    if (targetItem) break
  }

  if (!targetItem) {
    targetItem = parsed.immediateSteps.find(item => item.id === itemId)
  }

  if (!targetItem) {
    throw new Error(`Plan item not found: ${itemId}`)
  }

  const lines = content.split('\n')
  const line = lines[targetItem.lineIndex]

  if (checked) {
    lines[targetItem.lineIndex] = line.replace('- [ ]', '- [x]')
  } else {
    lines[targetItem.lineIndex] = line.replace('- [x]', '- [ ]')
  }

  return lines.join('\n')
}
