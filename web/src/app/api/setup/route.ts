import fs from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

const ENV_PATH = path.join(process.cwd(), '.env.local')

function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return vars
}

function serializeEnvFile(vars: Record<string, string>): string {
  return Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
}

// GET /api/setup — check if ANTHROPIC_API_KEY is configured
export async function GET() {
  try {
    const content = await fs.readFile(ENV_PATH, 'utf-8')
    const vars = parseEnvFile(content)
    const hasApiKey = !!vars.ANTHROPIC_API_KEY && vars.ANTHROPIC_API_KEY.startsWith('sk-ant-')
    return NextResponse.json({ hasApiKey })
  } catch {
    // .env.local doesn't exist
    return NextResponse.json({ hasApiKey: false })
  }
}

// POST /api/setup — save ANTHROPIC_API_KEY to .env.local
export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 })
    }

    let vars: Record<string, string> = {}
    try {
      const content = await fs.readFile(ENV_PATH, 'utf-8')
      vars = parseEnvFile(content)
    } catch {
      // file doesn't exist yet — start fresh
    }

    vars.ANTHROPIC_API_KEY = apiKey
    await fs.writeFile(ENV_PATH, serializeEnvFile(vars), 'utf-8')

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
