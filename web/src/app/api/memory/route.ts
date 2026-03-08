import { NextRequest, NextResponse } from 'next/server'
import { readMemoryFile, listMemoryFiles } from '@/lib/memory'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const file = request.nextUrl.searchParams.get('file')

  if (!file) {
    // Return list of available files
    const files = await listMemoryFiles()
    return NextResponse.json({ files })
  }

  try {
    const content = await readMemoryFile(file)
    return NextResponse.json({ file, content })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
