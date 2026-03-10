import { auth } from '@/auth'
import { decryptKey } from '@/lib/apikey'
import { readMemoryFile, readModeFile } from '@/lib/memory'
import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
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
  is_guest: boolean
  guest_expires_at: string | null
  api_key_enc: string | null
  free_quota_exhausted: boolean
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
    
    const supabase = createAdminClient()
    
    // 1. Fetch user profile to check guest status and get API key.
    // If the row is missing (e.g., first session), bootstrap it instead of hard-failing.
    const { data: existingProfile, error: profileFetchError } = await supabase
      .from('user_profiles')
      .select('is_guest, guest_expires_at, api_key_enc, free_quota_exhausted')
      .eq('id', userId)
      .maybeSingle()

    if (profileFetchError) {
      console.error('Failed to fetch user profile:', profileFetchError)
      return new Response(JSON.stringify({ error: 'Failed to load user profile' }), { status: 500 })
    }

    let userProfile: UserProfileRow | null = existingProfile
    if (!userProfile) {
      const isGuest =
        session.user?.name === 'Guest' ||
        Boolean(session.user?.email?.endsWith('@anonymous.local'))
      const guestExpiry = isGuest
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
        : null

      const { data: createdProfile, error: createProfileError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          is_guest: isGuest,
          guest_expires_at: guestExpiry,
          last_active_at: new Date().toISOString(),
          free_quota_exhausted: false,
        })
        .select('is_guest, guest_expires_at, api_key_enc, free_quota_exhausted')
        .single()

      if (createProfileError) {
        console.error('Failed to bootstrap user profile:', createProfileError)
        return new Response(JSON.stringify({ error: 'Failed to initialize user profile' }), { status: 500 })
      }

      userProfile = createdProfile
    }

    // Keep heartbeat updated (non-blocking).
    void (async () => {
      const { error } = await supabase
        .from('user_profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId)
        
      if (error) {
        console.error('Failed to update user last_active_at heartbeat:', error)
      }
    })().catch((err: unknown) => {
      console.error('Unexpected error during user last_active_at heartbeat:', err)
    })

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
    let usingFreeKey = true;
    if (!userProfile.is_guest && userProfile.api_key_enc) {
      const decryptedKey = decryptKey(userProfile.api_key_enc)
      if (decryptedKey) {
        apiKey = decryptedKey
        usingFreeKey = false;
      } else {
        return new Response(JSON.stringify({
          error: 'invalid_api_key',
          message: 'Your saved API key could not be decrypted. Please re-add it in Settings to continue.'
        }), { status: 403 })
      }
    }

    if (usingFreeKey) {
      if (userProfile.free_quota_exhausted) {
          if (userProfile.is_guest) {
            return new Response(JSON.stringify({ 
              error: 'guest_limit_reached',
              message: 'You have reached your free message limit as a guest. Please log in to continue.'
            }), { status: 403 })
          } else {
             return new Response(JSON.stringify({ 
               error: 'missing_api_key',
               message: 'You have exhausted your free messages. Please add your Anthropic API key in Settings to continue.'
             }), { status: 403 })
          }
      }

      // Check total messages across ALL sessions for this user (max 10 = 5 user + 5 assistant)
      const { data: totalMessagesData, error: countError } = await supabase
        .from('chat_sessions')
        .select('message_count')
        .eq('user_id', userId)
        
      if (countError) {
        console.error('Failed to fetch chat session message counts for free tier checking', countError)
        return new Response(JSON.stringify({ error: 'Failed to verify free tier limits' }), { status: 500 })
      } else if (totalMessagesData) {
        const totalMessages = totalMessagesData.reduce((sum, session) => sum + (session.message_count || 0), 0)
        
        if (totalMessages >= 10) { 
          // Update the specific flag so we don't need to compute this sum every time
          await supabase.from('user_profiles').update({ free_quota_exhausted: true }).eq('id', userId)

          if (userProfile.is_guest) {
            return new Response(JSON.stringify({ 
              error: 'guest_limit_reached',
              message: 'You have reached your free message limit as a guest. Please log in to continue.'
            }), { status: 403 })
          } else {
             return new Response(JSON.stringify({ 
               error: 'missing_api_key',
               message: 'You have exhausted your free messages. Please add your Anthropic API key in Settings to continue.'
             }), { status: 403 })
          }
        }
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
