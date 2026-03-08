import { NextRequest, NextResponse } from 'next/server'
import { readMemoryFile, writeMemoryFile } from '@/lib/memory'
import { addApplication, updateApplicationStatus } from '@/lib/parsers/job-search'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    let content = await readMemoryFile('job-search.md')

    if (action === 'add') {
      const { company, role, status, dateApplied, notes } = body
      if (!company || !role) {
        return NextResponse.json({ error: 'Missing company or role' }, { status: 400 })
      }
      content = addApplication(content, {
        company,
        role,
        status: status || 'Applied',
        dateApplied: dateApplied || new Date().toISOString().split('T')[0],
        notes: notes || '',
      })
    } else if (action === 'updateStatus') {
      const { company, role, newStatus } = body
      if (!company || !role || !newStatus) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      content = updateApplicationStatus(content, company, role, newStatus)
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    await writeMemoryFile('job-search.md', content)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
