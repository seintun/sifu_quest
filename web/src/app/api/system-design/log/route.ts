import { MemoryWriteError, readMemoryFile, writeMemoryFile } from '@/lib/memory'
import { addConceptToTable } from '@/lib/parsers/system-design'
import { logAuditEvent, logProgressEvent } from '@/lib/progress'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { systemDesignLogSchema, validationErrorResponse } from '@/lib/api-validation'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)

    const rawBody = await request.json()
    const parsedBody = systemDesignLogSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json(validationErrorResponse(parsedBody.error), { status: 400 })
    }

    const { concept, depthCovered, notes } = parsedBody.data

    const content = await readMemoryFile(userId, 'system-design.md')
    const date = new Date().toISOString().split('T')[0]
    const updated = addConceptToTable(content, {
      concept,
      depthCovered,
      date,
      notes: notes || '',
    })

    await writeMemoryFile(userId, 'system-design.md', updated, 'sys_design')

    await logProgressEvent(userId, 'system_design_logged', 'system-design', { concept, depthCovered })
    await logAuditEvent(userId, 'update_memory', 'system-design.md', { action: 'logged_sys_design' })

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
