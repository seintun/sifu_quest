import { auth } from '@/auth'
import { decryptKey } from '@/lib/apikey'
import { ensureUserProfile, touchUserLastActiveAt } from '@/lib/account-state'
import { getQuotaError, incrementFreeUserMessagesUsed, isUsingFreeTier } from '@/lib/free-quota'
import { readMemoryFile, readModeFile } from '@/lib/memory'
import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
const CHAT_UNAVAILABLE_MESSAGE = 'We hit a temporary issue loading your workspace. Please try again in a moment.'
const CHAT_STREAM_ERROR_MESSAGE = 'We hit a temporary issue generating a response. Please try again.'

const MODE_TO_FILES: Record<string, { mode: string; memory: string[] }> = {
  dsa: { mode: 'dsa.md', memory: ['profile.md', 'dsa-patterns.md', 'progress.md'] },
  'interview-prep': { mode: 'interview-prep.md', memory: ['profile.md', 'progress.md'] },
  'system-design': { mode: 'system-design.md', memory: ['profile.md', 'system-design.md', 'progress.md'] },
  'job-search': { mode: 'job-search.md', memory: ['profile.md', 'job-search.md', 'progress.md'] },
  'business-ideas': { mode: 'business-ideas.md', memory: ['profile.md', 'ideas.md'] },
}

type UserProfileRow = {
  is_guest: boolean
  guest_expires_at: string | null
  api_key_enc: string | null
  free_quota_exhausted: boolean
  free_user_messages_used: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    
    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const { messages, mode, isGreeting, sessionId } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    const userProfile: UserProfileRow = await ensureUserProfile(userId, session.user.email)

    // Keep heartbeat updated (non-blocking).
    void touchUserLastActiveAt(userId)

    // 2. Guest enforcement and Free tier enforcement
    let apiKey = process.env.ANTHROPIC_API_KEY
    
    if (userProfile.is_guest) {
      // Check 30-min TTL
      if (userProfile.guest_expires_at && new Date() > new Date(userProfile.guest_expires_at)) {
        return new Response(JSON.stringify({ 
          error: 'session_expired', 
          message: 'Your guest session has expired. Please log in to continue.' 
        }), { status: 403 })
      }
    }

    // Determine if we need to use the free key or user's key
    const usingFreeKey = isUsingFreeTier(userProfile)
    if (!usingFreeKey && userProfile.api_key_enc) {
      const decryptedKey = decryptKey(userProfile.api_key_enc)
      if (decryptedKey) {
        apiKey = decryptedKey
      } else {
        return new Response(JSON.stringify({
          error: 'invalid_api_key',
          message: 'Your saved API key could not be decrypted. Please re-add it in Settings to continue.'
        }), { status: 403 })
      }
    }

    if (usingFreeKey) {
      const quotaError = getQuotaError(userProfile)
      if (quotaError) {
        return new Response(JSON.stringify(quotaError), { status: 403 })
      }
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })
    }

    // Build system prompt from mode + memory files
    let systemPrompt = 'You are Sifu, a helpful mastery coach.'

    const modeConfig = MODE_TO_FILES[mode || 'dsa']
    if (modeConfig) {
      const modeContent = await readModeFile(modeConfig.mode)
      if (modeContent) {
        systemPrompt = modeContent
      }

      const memoryParts: string[] = []
      let profileContent = ''
      for (const memFile of modeConfig.memory) {
        const content = await readMemoryFile(userId, memFile)
        if (content) {
          memoryParts.push(`### ${memFile}\n${content}`)
          if (memFile === 'profile.md') profileContent = content
        }
      }

      if (memoryParts.length > 0) {
        systemPrompt += '\n\n---\n## Current Memory Context\n\n' + memoryParts.join('\n\n')
      }

      if (isGreeting) {
        const nameMatch = profileContent.match(/\*\*Name:\*\*\s*(.+)/)
        const userName = nameMatch ? nameMatch[1].trim() : null
        const nameInstruction = userName
          ? `Greet the user as "${userName}" — this name comes directly from their memory profile.`
          : 'No name found in memory — use a neutral greeting without fabricating a name.'
        systemPrompt += `\n\n---\n## Greeting Instruction\n\nThe user just opened this mastery mode. Write a warm, concise welcome (2-4 sentences). ${nameInstruction} Reference their past progress from memory if relevant. End with one open question to kick off the session.`
      }
    } else if (isGreeting) {
      systemPrompt += '\n\n---\n## Greeting Instruction\n\nThe user just opened this mastery mode. Write a warm, concise welcome (2-4 sentences). Use a neutral greeting. End with one open question to kick off the session.'
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

    // Prepare to save messages to DB if we have a sessionId
    let assistantMessageContent = ""
    const lastUserMessage = messages[messages.length - 1]

    // Convert to ReadableStream for streaming response
    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        let streamClosed = false
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              assistantMessageContent += event.delta.text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          streamClosed = true
          
          // Save to database asynchronously after stream closes
          if (sessionId && lastUserMessage) {
              const supabaseAction = createAdminClient()

              const { data: ownedSession } = await supabaseAction
                .from('chat_sessions')
                .select('id')
                .eq('id', sessionId)
                .eq('user_id', userId)
                .maybeSingle()

              if (!ownedSession) {
                return
              }
              
              // Insert user message
              await supabaseAction.from('chat_messages').insert({
                session_id: sessionId,
                user_id: userId,
                role: 'user',
                content: lastUserMessage.content
              })
              
              // Insert assistant message we just streamed
              await supabaseAction.from('chat_messages').insert({
                session_id: sessionId,
                user_id: userId,
                role: 'assistant',
                content: assistantMessageContent
              })
              
              // Update session message count
              await supabaseAction.rpc('increment_session_messages', {
                 session_id_param: sessionId,
                 increment_by: 2
              })

              if (usingFreeKey) {
                try {
                  await incrementFreeUserMessagesUsed(userId, 1)
                } catch (quotaError) {
                  console.error('Failed to increment free quota usage', quotaError)
                }
              }
          }
        } catch (error) {
          if (!streamClosed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: CHAT_STREAM_ERROR_MESSAGE })}\n\n`))
            controller.close()
            return
          }
          console.error('Post-stream persistence failed after stream closed', error)
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
    console.error('Failed to process chat request', error)
    return new Response(JSON.stringify({ error: 'chat_unavailable', message: CHAT_UNAVAILABLE_MESSAGE }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
