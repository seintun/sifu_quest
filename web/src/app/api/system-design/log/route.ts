import { readMemoryFile, writeMemoryFile } from '@/lib/memory'
import { addConceptToTable } from '@/lib/parsers/system-design'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { concept, depthCovered, notes } = body

    if (!concept || !depthCovered) {
      return NextResponse.json(
        { error: 'concept and depthCovered are required' },
        { status: 400 }
      )
    }

    const content = await readMemoryFile('system-design.md')
    const date = new Date().toISOString().split('T')[0]
    const updated = addConceptToTable(content, {
      concept,
      depthCovered,
      date,
      notes: notes || '',
    })

    await writeMemoryFile('system-design.md', updated)

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
