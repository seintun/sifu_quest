import { NextRequest, NextResponse } from 'next/server'
import { readMemoryFile, writeMemoryFile } from '@/lib/memory'
import { togglePlanItem } from '@/lib/parsers/plan-parser'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { itemId, checked } = await request.json()

    if (!itemId || typeof checked !== 'boolean') {
      return NextResponse.json({ error: 'Missing itemId or checked' }, { status: 400 })
    }

    const content = await readMemoryFile('plan.md')
    const updated = togglePlanItem(content, itemId, checked)
    await writeMemoryFile('plan.md', updated)

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
