import { MemoryWriteError, readMemoryFile, writeMemoryFile } from '@/lib/memory'
import { togglePlanItem } from '@/lib/parsers/plan-parser'
import { logAuditEvent, logProgressEvent } from '@/lib/progress'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { planToggleSchema, validationErrorResponse } from '@/lib/api-validation'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)

    const rawBody = await request.json()
    const parsedBody = planToggleSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json(validationErrorResponse(parsedBody.error), { status: 400 })
    }

    const { itemId, checked } = parsedBody.data

    const content = await readMemoryFile(userId, 'plan.md')
    const updated = togglePlanItem(content, itemId, checked)
    await writeMemoryFile(userId, 'plan.md', updated, 'plan_toggle')

    await logProgressEvent(userId, 'plan_item_checked', 'plan', { itemId, checked })
    await logAuditEvent(userId, 'update_memory', 'plan.md', { action: 'toggled_plan_item', checked })

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
