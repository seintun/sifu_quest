import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

// Returns a stable AES-256 key derived from the API key.
// Never persisted in the browser — only held in memory per page load.
export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }
  const key = crypto
    .createHash('sha256')
    .update(`thinking-buddy-chat-history:${apiKey}`)
    .digest('hex')
  return NextResponse.json({ key })
}
