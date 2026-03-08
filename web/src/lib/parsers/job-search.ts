export interface JobApplication {
  company: string
  role: string
  status: string
  dateApplied: string
  notes: string
}

export function parseJobApplications(content: string): JobApplication[] {
  const apps: JobApplication[] = []
  const lines = content.split('\n')

  let inTable = false
  let headerPassed = false

  for (const line of lines) {
    if (line.includes('| Company |') && line.includes('| Role |')) {
      inTable = true
      headerPassed = false
      continue
    }
    if (inTable && line.match(/^\|[-\s|]+\|$/)) {
      headerPassed = true
      continue
    }
    if (inTable && headerPassed) {
      if (!line.startsWith('|')) {
        inTable = false
        continue
      }
      const cells = line.split('|').map(c => c.trim()).filter(Boolean)
      if (cells.length >= 5 && !cells.every(c => c === '—')) {
        apps.push({
          company: cells[0],
          role: cells[1],
          status: cells[2],
          dateApplied: cells[3],
          notes: cells[4] || '',
        })
      }
    }
  }
  return apps
}

export function addApplication(content: string, app: JobApplication): string {
  const row = `| ${app.company} | ${app.role} | ${app.status} | ${app.dateApplied} | ${app.notes} |`

  // Replace placeholder row if it exists
  const placeholderRegex = /\| — \| — \| — \| — \| — \|/
  if (placeholderRegex.test(content)) {
    return content.replace(placeholderRegex, row)
  }

  // Append after the last row of the Applications table
  const lines = content.split('\n')
  let lastTableRow = -1
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('| Company |') && lines[i].includes('| Role |')) {
      inTable = true
      continue
    }
    if (inTable && lines[i].startsWith('|')) {
      lastTableRow = i
    }
    if (inTable && !lines[i].startsWith('|') && lines[i].trim() !== '') {
      break
    }
  }

  if (lastTableRow !== -1) {
    lines.splice(lastTableRow + 1, 0, row)
    return lines.join('\n')
  }
  return content
}

export function updateApplicationStatus(
  content: string,
  company: string,
  role: string,
  newStatus: string
): string {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|') && lines[i].includes(company) && lines[i].includes(role)) {
      const cells = lines[i].split('|').map(c => c.trim()).filter(Boolean)
      if (cells[0] === company && cells[1] === role) {
        cells[2] = newStatus
        lines[i] = '| ' + cells.join(' | ') + ' |'
        break
      }
    }
  }
  return lines.join('\n')
}
