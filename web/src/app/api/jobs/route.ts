import { MemoryWriteError, readMemoryFile, writeMemoryFile } from '@/lib/memory'
import { addApplication, updateApplicationStatus } from '@/lib/parsers/job-search'
import { logAuditEvent, logProgressEvent } from '@/lib/progress'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)

    const body = await request.json()
    const { action } = body

    let content = await readMemoryFile(userId, 'job-search.md')

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
      await logProgressEvent(userId, 'job_application_added', 'jobs', { company, role })
      await logAuditEvent(userId, 'update_memory', 'job-search.md', { action: 'added_job' })
    } else if (action === 'updateStatus') {
      const { company, role, newStatus } = body
      if (!company || !role || !newStatus) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      content = updateApplicationStatus(content, company, role, newStatus)
      await logProgressEvent(userId, 'job_application_updated', 'jobs', { company, role, newStatus })
      await logAuditEvent(userId, 'update_memory', 'job-search.md', { action: 'updated_job_status' })
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    await writeMemoryFile(userId, 'job-search.md', content, 'job_app')
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof MemoryWriteError && error.dbCode === '23503') {
      return NextResponse.json(
        { error: 'Session identity is out of sync. Please sign out and sign in again.', code: 'identity_mismatch' },
        { status: 409 },
      )
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
