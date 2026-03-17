import { createApiErrorResponse, createRequestId } from '@/lib/api-error-response'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

function getAdminSecret(): string | null {
  const secret = process.env.ADMIN_SECRET
  if (!secret || secret.trim().length === 0) {
    return null
  }
  return secret
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId()

  try {
    const secret = getAdminSecret()
    if (!secret) {
      return NextResponse.json(
        {
          error: 'Admin secret is not configured.',
          code: 'admin_secret_missing',
          requestId,
        },
        { status: 503 },
      )
    }

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token !== secret) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'unauthorized', requestId },
        { status: 401 },
      )
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('cleanup_expired_guests')

    if (error) {
      throw error
    }

    const cleanedCount = typeof data === 'number' ? data : 0

    return NextResponse.json({
      success: true,
      cleanedCount,
      requestId,
    })
  } catch (error) {
    return createApiErrorResponse(error, {
      route: '/api/admin/cleanup-guests',
      requestId,
      action: 'cleanup-expired-guests',
      fallbackMessage: 'Failed to clean up expired guest sessions.',
    })
  }
}
