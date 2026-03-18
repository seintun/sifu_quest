import { auth } from '@/auth'
import { listMemoryFiles, readMemoryFile } from '@/lib/memory'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'
import { memoryGetSchema, validationErrorResponse } from '@/lib/api-validation'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = await resolveCanonicalUserId(session.user.id, session.user.email)

  const rawParams = { file: request.nextUrl.searchParams.get('file') ?? undefined }
  const parsedParams = memoryGetSchema.safeParse(rawParams)
  if (!parsedParams.success) {
    return NextResponse.json(validationErrorResponse(parsedParams.error), { status: 400 })
  }

  const file = parsedParams.data.file

  if (!file) {
    // Return list of available files
    const files = await listMemoryFiles(userId)
    return NextResponse.json({ files })
  }

  try {
    const content = await readMemoryFile(userId, file)
    return NextResponse.json({ file, content })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
