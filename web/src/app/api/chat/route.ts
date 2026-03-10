import { auth } from '@/auth'
import { decryptKey } from '@/lib/apikey'
import { evaluateTrialEntitlement } from '@/lib/entitlements'
import { readMemoryFile, readModeFile } from '@/lib/memory'
import { createClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

const MODE_TO_FILES: Record<string, { mode: string; memory: string[] }> = {
  dsa: { mode: 'dsa.md', memory: ['profile.md', 'dsa-patterns.md', 'progress.md'] },
  'interview-prep': { mode: 'interview-prep.md', memory: ['profile.md', 'progress.md'] },
  'system-design': { mode: 'system-design.md', memory: ['profile.md', 'system-design.md', 'progress.md'] },
  'job-search': { mode: 'job-search.md', memory: ['profile.md', 'job-search.md', 'progress.md'] },
  'business-ideas': { mode: 'business-ideas.md', memory: ['profile.md', 'ideas.md'] },
}

type UserProfileRow = {
  api_key_enc: string | null
  trial_started_at: string | null
  trial_messages_used: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    
    const userId = session.user.id
    const { messages, mode, isGreeting, sessionId } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    
    const supabase = await createClient()
    
    // 1. Fetch user profile to check guest status and get API key.
    // If the row is missing (e.g., first session), bootstrap it instead of hard-failing.
    const { data: existingProfile, error: profileFetchError } = await supabase
      .from('user_profiles')
      .select('api_key_enc, trial_started_at, trial_messages_used')
      .eq('id', userId)
      .maybeSingle()

    if (profileFetchError) {
      console.error('Failed to fetch user profile:', profileFetchError)
      return new Response(JSON.stringify({ error: 'Failed to load user profile' }), { status: 500 })
    }

    let userProfile: UserProfileRow | null = existingProfile
    if (!userProfile) {
      const { data: createdProfile, error: createProfileError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          trial_started_at: null,
          trial_messages_used: 0,
          last_active_at: new Date().toISOString(),
        })
        .select('api_key_enc, trial_started_at, trial_messages_used')
        .single()

      if (createProfileError) {
        console.error('Failed to bootstrap user profile:', createProfileError)
        return new Response(JSON.stringify({ error: 'Failed to initialize user profile' }), { status: 500 })
      }

      userProfile = createdProfile
    }

    // Keep heartbeat updated (non-blocking).
    void supabase
      .from('user_profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId)

    // 2. Validate session ownership if provided
    if (sessionId) {
      const { data: ownedSession } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle()

      if (!ownedSession) {
        return new Response(JSON.stringify({
          error: 'invalid_session',
          message: 'Invalid chat session for this user.'
        }), { status: 403 })
      }
    }

    // 3. Resolve key source: personal key unlocks unlimited usage, otherwise trial limits apply.
    let apiKey: string | null = null
    let usingTrialKey = false

    if (userProfile.api_key_enc) {
      const decryptedKey = decryptKey(userProfile.api_key_enc)
      if (!decryptedKey) {
        return new Response(JSON.stringify({ error: 'Failed to decrypt API key' }), { status: 500 })
      }
      apiKey = decryptedKey
    } else {
      apiKey = process.env.ANTHROPIC_API_KEY || null
      usingTrialKey = true
    }

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'missing_api_key',
        message: 'No API key is configured. Please add your personal Anthropic API key in Settings.'
      }), { status: 403 })
    }

    if (usingTrialKey) {
      const trialState = evaluateTrialEntitlement({
        trialStartedAt: userProfile.trial_started_at,
        trialMessagesUsed: userProfile.trial_messages_used,
      })

      if (!trialState.allowed && trialState.code === 'trial_limit_reached') {
        return new Response(JSON.stringify({
          error: 'trial_limit_reached',
          message: 'You have reached the 5-message trial limit. Add your own API key in Settings to continue.'
        }), { status: 403 })
      }

      if (!trialState.allowed && trialState.code === 'trial_expired') {
        return new Response(JSON.stringify({
          error: 'trial_expired',
          message: 'Your 30-minute trial window has expired. Add your own API key in Settings to continue.'
        }), { status: 403 })
      }

      if (!userProfile.trial_started_at) {
        const startedAt = new Date().toISOString()
        userProfile.trial_started_at = startedAt
        await supabase
          .from('user_profiles')
          .update({ trial_started_at: startedAt })
          .eq('id', userId)
      }
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
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              assistantMessageContent += event.delta.text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          
          // Save to database asynchronously after stream closes
          if (sessionId && lastUserMessage) {
              const supabaseAction = await createClient()

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

              if (usingTrialKey) {
                const nextTrialCount = (userProfile?.trial_messages_used || 0) + 1
                userProfile.trial_messages_used = nextTrialCount
                await supabaseAction
                  .from('user_profiles')
                  .update({ trial_messages_used: nextTrialCount })
                  .eq('id', userId)
              }
          }
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
