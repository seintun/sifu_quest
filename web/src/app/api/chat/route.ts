import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { readMemoryFile, readModeFile } from '@/lib/memory'

export const runtime = 'nodejs'

const MODE_TO_FILES: Record<string, { mode: string; memory: string[] }> = {
  dsa: { mode: 'dsa.md', memory: ['profile.md', 'dsa-patterns.md', 'progress.md'] },
  'interview-prep': { mode: 'interview-prep.md', memory: ['profile.md', 'progress.md'] },
  'system-design': { mode: 'system-design.md', memory: ['profile.md', 'system-design.md', 'progress.md'] },
  'job-search': { mode: 'job-search.md', memory: ['profile.md', 'job-search.md', 'progress.md'] },
  'business-ideas': { mode: 'business-ideas.md', memory: ['profile.md', 'ideas.md'] },
}

export async function POST(request: NextRequest) {
  try {
    const { messages, mode, isGreeting } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey === 'sk-your-key-here') {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build system prompt from mode + memory files
    let systemPrompt = 'You are a helpful coaching assistant.'

    const modeConfig = MODE_TO_FILES[mode || 'dsa']
    if (modeConfig) {
      const modeContent = await readModeFile(modeConfig.mode)
      if (modeContent) {
        systemPrompt = modeContent
      }

      const memoryParts: string[] = []
      for (const memFile of modeConfig.memory) {
        const content = await readMemoryFile(memFile)
        if (content) {
          memoryParts.push(`### ${memFile}\n${content}`)
        }
      }

      if (memoryParts.length > 0) {
        systemPrompt += '\n\n---\n## Current Memory Context\n\n' + memoryParts.join('\n\n')
      }
    }

    if (isGreeting) {
      systemPrompt += '\n\n---\n## Greeting Instruction\n\nThe user just opened this coaching mode. Write a warm, concise welcome (2-4 sentences). Do not use a canned opener like "Hey [Name]! Welcome back." Use the user\'s name only if it is explicitly present in memory; otherwise use a neutral greeting. Reference their past progress from memory if relevant. End with one open question to kick off the session.'
    }

    const client = new Anthropic({ apiKey })

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    // Convert to ReadableStream for streaming response
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Stream error'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
