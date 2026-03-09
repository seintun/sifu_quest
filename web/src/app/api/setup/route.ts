import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

// GET — check whether the API key is already configured
export async function GET() {
  const hasApiKey = !!(
    process.env.ANTHROPIC_API_KEY &&
    process.env.ANTHROPIC_API_KEY !== 'sk-your-key-here'
  )
  return NextResponse.json({ hasApiKey })
}

// POST — verify the key works, then save it to .env.local and the running process
export async function POST(request: NextRequest) {
  const { apiKey } = await request.json()

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) {
    return NextResponse.json({ error: 'Invalid API key — must start with sk-ant-' }, { status: 400 })
  }

  // Verify the key is valid before saving
  try {
    const client = new Anthropic({ apiKey })
    await client.models.list()
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 401) {
      return NextResponse.json({ error: 'API key is invalid or has been revoked' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Could not reach Anthropic — check your connection' }, { status: 502 })
  }

  const memoryDir = path.join(os.homedir(), '.claude-memory/claude_thinking_buddy')
  const envPath = path.resolve(process.cwd(), '.env.local')

  const envContent = [
    `ANTHROPIC_API_KEY=${apiKey}`,
    `MEMORY_DIR=${memoryDir}`,
    `MODES_DIR=../modes`,
  ].join('\n') + '\n'

  await fs.writeFile(envPath, envContent, 'utf-8')

  // Apply immediately to the running process — no restart needed
  process.env.ANTHROPIC_API_KEY = apiKey
  process.env.MEMORY_DIR = memoryDir

  return NextResponse.json({ success: true })
}
