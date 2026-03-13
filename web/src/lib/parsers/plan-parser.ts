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

export interface PlanMetadata {
  key: string
  value: string
}

export interface DashboardEntry {
  [key: string]: string
}

export interface ParsedPlan {
  title: string
  metadata: PlanMetadata[]
  dashboard: {
    headers: string[]
    rows: DashboardEntry[]
  }
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
  const metadata: PlanMetadata[] = []
  const dashboardHeaders: string[] = []
  const dashboardRows: DashboardEntry[] = []
  const weeklyRhythm: WeeklyRhythmEntry[] = []
  const months: MonthSection[] = []
  const redFlags: Array<{ symptom: string; fix: string }> = []
  const immediateSteps: PlanItem[] = []

  let title = 'My Plan'
  let currentMonth: MonthSection | null = null
  let currentCategory = ''
  let currentSection = ''
  let itemCounters: Record<string, number> = {}

  // Parse state
  let inDashboardTable = false
  let dashboardHeaderPassed = false
  let inWeeklyRhythmTable = false
  let weeklyRhythmHeaderPassed = false
  let weeklyRhythmHeaders: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line && !inDashboardTable && !inWeeklyRhythmTable) continue

    // Title: # Title
    const titleMatch = line.match(/^# (.+)/)
    if (titleMatch) {
      title = titleMatch[1].trim()
      continue
    }

    // Metadata: > **Key:** Value
    const metaMatch = line.match(/^>\s*\*\*([^:]+):\*\*\s*(.+)$/)
    if (metaMatch && currentSection === '') {
      metadata.push({ key: metaMatch[1].trim(), value: metaMatch[2].trim() })
      continue
    }

    // Weekly Rhythm section header
    if (line.match(/^##\s+Weekly Rhythm/i)) {
      currentSection = 'weeklyrhythm'
      inWeeklyRhythmTable = false
      weeklyRhythmHeaderPassed = false
      weeklyRhythmHeaders = []
      continue
    }

    // Weekly Rhythm table
    if (currentSection === 'weeklyrhythm' && line.startsWith('|') && !inWeeklyRhythmTable) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean)
      if (cells.length >= 2) {
        inWeeklyRhythmTable = true
        weeklyRhythmHeaderPassed = false
        weeklyRhythmHeaders = cells.map(h => h.toLowerCase())
      }
      continue
    }

    if (inWeeklyRhythmTable) {
      if (!line.startsWith('|')) {
        inWeeklyRhythmTable = false
      } else if (line.match(/^\|[:\-\s|]+\|$/)) {
        weeklyRhythmHeaderPassed = true
      } else if (weeklyRhythmHeaderPassed) {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean)
        const dayIdx = weeklyRhythmHeaders.indexOf('day')
        const focusIdx = weeklyRhythmHeaders.indexOf('focus')
        const timeIdx = weeklyRhythmHeaders.indexOf('time')
        weeklyRhythm.push({
          day: cells[dayIdx >= 0 ? dayIdx : 0] || '',
          focus: cells[focusIdx >= 0 ? focusIdx : 1] || '',
          time: cells[timeIdx >= 0 ? timeIdx : 2] || '',
        })
      }
      continue
    }

    // Dashboard table
    if (line.startsWith('|') && line.includes('|') && !inDashboardTable && currentSection === '') {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean)
      if (cells.length >= 2) {
        inDashboardTable = true
        dashboardHeaderPassed = false
        dashboardHeaders.push(...cells)
      }
      continue
    }

    if (inDashboardTable) {
      if (!line.startsWith('|')) {
        inDashboardTable = false
      } else if (line.match(/^\|[:\-\s|]+\|$/)) {
        dashboardHeaderPassed = true
      } else if (dashboardHeaderPassed) {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean)
        const row: DashboardEntry = {}
        dashboardHeaders.forEach((header, idx) => {
          row[header] = cells[idx] || ''
        })
        dashboardRows.push(row)
      }
      continue
    }

    // Month headers: ## Month N — ... or ## Month N: ...
    const monthMatch = line.match(/^## Month (\d+)\s*[:—–-]\s*(.+)$/i)
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

    // Theme line (supports blockquote style)
    if (currentMonth && (line.startsWith('**Theme:') || line.startsWith('> **Theme:'))) {
      currentMonth.theme = line.replace(/^>\s*/, '').replace(/\*\*/g, '').replace('Theme:', '').trim()
      continue
    }

    // Category headers (### DSA, ### System Design, ### Job Search, or with emojis)
    const catMatch = line.match(/^###\s*(?:[^\w\s]+\s*)?(.+)/)
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
    if (currentSection === 'redflags' && line.startsWith('|') && !line.includes('| Symptom |') && !line.match(/^\|[:\-\s|]+\|$/)) {
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

    // Checklist items (- [ ] or - [x]) or regular list items (- Item)
    const checkMatch = line.match(/^\s*-\s+(?:\[([ x])\]\s+)?(.+)/)
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
      continue
    }

    // Bold subheaders within months to be captured as informational items (without checkbox)
    if (currentMonth && currentCategory && line.match(/^\s*\*\*([^*]+)\*\*\s*$/)) {
      const text = line.trim()
      const categorySlug = slugify(currentCategory)
      const counterKey = `month${currentMonth.month}-${categorySlug}`
      if (!itemCounters[counterKey]) itemCounters[counterKey] = 0
      const index = itemCounters[counterKey]++
      
      const id = `month${currentMonth.month}-${categorySlug}-info-${index}`
      
      const item: PlanItem = {
        id,
        text,
        checked: false, // Informational items can't be "checked" in the traditional sense
        category: currentCategory,
        month: currentMonth.month,
        week: null,
        lineIndex: i,
      }
      
      currentMonth.categories[currentCategory].push(item)
      continue
    }
  }

  return { 
    title, 
    metadata, 
    dashboard: { headers: dashboardHeaders, rows: dashboardRows }, 
    weeklyRhythm,
    months, 
    redFlags, 
    immediateSteps 
  }
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
    if (line.includes('- [ ]')) {
      lines[targetItem.lineIndex] = line.replace('- [ ]', '- [x]')
    } else if (line.match(/^\s*-\s+/)) {
      lines[targetItem.lineIndex] = line.replace(/^\s*-\s+/, match => match.replace('-', '- [x]'))
    }
  } else {
    if (line.includes('- [x]')) {
      lines[targetItem.lineIndex] = line.replace('- [x]', '- [ ]')
    } else if (line.match(/^\s*-\s+/)) {
      lines[targetItem.lineIndex] = line.replace(/^\s*-\s+/, match => match.replace('-', '- [ ]'))
    }
  }

  return lines.join('\n')
}
