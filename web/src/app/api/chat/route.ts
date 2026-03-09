import { decryptKey } from '@/lib/apikey'
import { readMemoryFile, readModeFile } from '@/lib/memory'
import { createClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { auth } from '../auth/[...nextauth]/route'

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
    
    // 1. Fetch user profile to check guest status and get API key
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_guest, guest_expires_at, api_key_enc')
      .eq('id', userId)
      .single()
      
    if (!userProfile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), { status: 404 })
    }
    
    // 2. Guest enforcement
    let apiKey = process.env.ANTHROPIC_API_KEY
    
    if (userProfile.is_guest) {
      // Check 30-min TTL
      if (userProfile.guest_expires_at && new Date() > new Date(userProfile.guest_expires_at)) {
        return new Response(JSON.stringify({ 
          error: 'session_expired', 
          message: 'Your guest session has expired. Please log in to continue.' 
        }), { status: 403 })
      }
      
      // Check 5-message limit using active chat session ID
      if (sessionId) {
        const { data: sessionData } = await supabase
          .from('chat_sessions')
          .select('message_count')
          .eq('id', sessionId)
          .single()
          
        if (sessionData && sessionData.message_count >= 10) { // 5 user + 5 assistant messages
          return new Response(JSON.stringify({ 
            error: 'limit_reached',
            message: 'You have reached your free message limit. Please log in to continue.'
          }), { status: 403 })
        }
      }
    } else {
      // 3. Logged-in user: must provide their own key
      if (!userProfile.api_key_enc) {
         return new Response(JSON.stringify({ 
           error: 'missing_api_key',
           message: 'Please add your Anthropic API key in Settings to continue.'
         }), { status: 403 })
      }
      const decryptedKey = decryptKey(userProfile.api_key_enc)
      if (!decryptedKey) {
        return new Response(JSON.stringify({ error: 'Failed to decrypt API key' }), { status: 500 })
      }
      apiKey = decryptedKey
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500 })
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
        systemPrompt += `\n\n---\n## Greeting Instruction\n\nThe user just opened this coaching mode. Write a warm, concise welcome (2-4 sentences). ${nameInstruction} Reference their past progress from memory if relevant. End with one open question to kick off the session.`
      }
    } else if (isGreeting) {
      systemPrompt += '\n\n---\n## Greeting Instruction\n\nThe user just opened this coaching mode. Write a warm, concise welcome (2-4 sentences). Use a neutral greeting. End with one open question to kick off the session.'
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
