export interface SystemDesignConcept {
  concept: string
  depthCovered: string
  date: string
  notes: string
}

export interface SystemDesignDiscussion {
  title: string
  content: string
}

export interface ParsedSystemDesign {
  concepts: SystemDesignConcept[]
  discussions: SystemDesignDiscussion[]
  gaps: string[]
  referenceTopics: string[]
}

export function parseSystemDesign(content: string): ParsedSystemDesign {
  const concepts: SystemDesignConcept[] = []
  const discussions: SystemDesignDiscussion[] = []
  const gaps: string[] = []
  const referenceTopics: string[] = []
  const lines = content.split('\n')

  let section = ''
  let inConceptTable = false
  let conceptHeaderPassed = false
  let currentDiscussion: SystemDesignDiscussion | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Section detection
    if (line.startsWith('## Concepts Covered')) {
      section = 'concepts'
      continue
    }
    if (line.startsWith('## Key Discussions')) {
      section = 'discussions'
      continue
    }
    if (line.startsWith('## Known Gaps') || line.startsWith('## Gaps')) {
      section = 'gaps'
      continue
    }
    if (line.startsWith('## Reference') || line.startsWith('## Patterns')) {
      section = 'reference'
      continue
    }
    if (line.startsWith('## ') && !line.startsWith('## ')) {
      section = ''
      continue
    }

    // Concepts table
    if (section === 'concepts') {
      if (line.includes('| Concept |') && line.includes('| Depth')) {
        inConceptTable = true
        conceptHeaderPassed = false
        continue
      }
      if (inConceptTable && line.match(/^\|[-\s|]+\|$/)) {
        conceptHeaderPassed = true
        continue
      }
      if (inConceptTable && conceptHeaderPassed) {
        if (!line.startsWith('|')) {
          inConceptTable = false
          continue
        }
        const cells = line.split('|').map(c => c.trim()).filter(Boolean)
        if (cells.length >= 4 && !cells.every(c => c === '—')) {
          concepts.push({
            concept: cells[0],
            depthCovered: cells[1],
            date: cells[2],
            notes: cells[3] || '',
          })
        }
      }
    }

    // Discussions (### headings under Key Discussions)
    if (section === 'discussions') {
      const discMatch = line.match(/^### (.+)/)
      if (discMatch) {
        if (currentDiscussion) discussions.push(currentDiscussion)
        currentDiscussion = { title: discMatch[1], content: '' }
        continue
      }
      if (currentDiscussion && line.trim()) {
        currentDiscussion.content += line + '\n'
      }
    }

    // Gaps
    if (section === 'gaps' && line.startsWith('- ') && !line.includes('(Claude flags')) {
      const gapText = line.replace(/^- /, '').trim()
      if (gapText && gapText !== '(built up over sessions)') {
        gaps.push(gapText)
      }
    }

    // Reference topics
    if (section === 'reference' && line.startsWith('- ')) {
      referenceTopics.push(line.replace(/^- /, '').trim())
    }
  }

  if (currentDiscussion) discussions.push(currentDiscussion)

  return { concepts, discussions, gaps, referenceTopics }
}

export function addConceptToTable(
  content: string,
  concept: { concept: string; depthCovered: string; date: string; notes: string }
): string {
  const row = `| ${concept.concept} | ${concept.depthCovered} | ${concept.date} | ${concept.notes} |`

  // Replace placeholder row if it exists
  const placeholderRegex = /\| — \| — \| — \| — \|/
  if (placeholderRegex.test(content)) {
    return content.replace(placeholderRegex, row)
  }

  // Append after the last row of the Concepts Covered table
  const lines = content.split('\n')
  let lastTableRow = -1
  let inConceptTable = false

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('| Concept |') && lines[i].includes('| Depth')) {
      inConceptTable = true
      continue
    }
    if (inConceptTable && lines[i].startsWith('|')) {
      lastTableRow = i
    }
    if (inConceptTable && !lines[i].startsWith('|') && lines[i].trim() !== '') {
      break
    }
  }

  if (lastTableRow !== -1) {
    lines.splice(lastTableRow + 1, 0, row)
    return lines.join('\n')
  }

  return content
}
