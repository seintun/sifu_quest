import { auth } from '@/auth'
import { decryptKey } from '@/lib/apikey'
import { ensureUserProfile, touchUserLastActiveAt } from '@/lib/account-state'
import { estimateCostMicrousd, normalizeTokenUsage, type TokenUsage } from '@/lib/chat-usage'
import { resolveProviderSelection } from '@/lib/chat-selection'
import {
  OPENROUTER_FREE_ROUTER_MODEL,
  isOpenRouterFreeModel,
  type ChatProvider,
} from '@/lib/chat-provider-config'
import { getQuotaError, incrementFreeUserMessagesUsed, isUsingFreeTier } from '@/lib/free-quota'
import { readMemoryFile, readModeFile } from '@/lib/memory'
import { getEncryptedProviderApiKey, hasEncryptedProviderApiKey } from '@/lib/provider-api-keys'
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

type StreamResult = {
  assistantContent: string
  usage: TokenUsage
  requestId: string | null
  latencyMs: number
  modelUsed: string
}

type ChatRequestPayload = {
  messages?: Array<{ role: string; content: string }>
  mode?: string
  isGreeting?: boolean
  sessionId?: string | null
  provider?: string
  model?: string
}

class ProviderStreamError extends Error {
  streamStarted: boolean
  status?: number

  constructor(message: string, streamStarted: boolean, status?: number) {
    super(message)
    this.name = 'ProviderStreamError'
    this.streamStarted = streamStarted
    this.status = status
  }
}

async function buildSystemPrompt(
  userId: string,
  mode: string | undefined,
  isGreeting: boolean | undefined,
): Promise<string> {
  let systemPrompt = 'You are Sifu, a helpful mastery coach.'
  const modeConfig = MODE_TO_FILES[mode || 'dsa']

  if (!modeConfig) {
    if (isGreeting) {
      systemPrompt += '\n\n---\n## Greeting Instruction\n\nThe user just opened this mastery mode. Write a warm, concise welcome (2-4 sentences). Use a neutral greeting. End with one open question to kick off the session.'
    }
    return systemPrompt
  }

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
      if (memFile === 'profile.md') {
        profileContent = content
      }
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

  return systemPrompt
}

function extractOpenRouterDeltaText(delta: unknown): string {
  if (typeof delta === 'string') {
    return delta
  }

  if (!Array.isArray(delta)) {
    return ''
  }

  return delta
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      const typed = part as { type?: string; text?: string }
      if (typed.type === 'text' && typeof typed.text === 'string') {
        return typed.text
      }
      return ''
    })
    .join('')
}

async function streamAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): Promise<StreamResult> {
  const startedAt = Date.now()
  const client = new Anthropic({ apiKey })
  const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  let assistantMessageContent = ''
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      assistantMessageContent += event.delta.text
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
    }
  }

  let usage = normalizeTokenUsage(null, null, null)
  let requestId: string | null = null
  try {
    const finalMessage = await stream.finalMessage()
    usage = normalizeTokenUsage(finalMessage.usage?.input_tokens, finalMessage.usage?.output_tokens, null)
    requestId = finalMessage.id ?? null
  } catch (error) {
    console.warn('Unable to resolve Anthropic final usage payload', error)
  }

  return {
    assistantContent: assistantMessageContent,
    usage,
    requestId,
    latencyMs: Date.now() - startedAt,
    modelUsed: model,
  }
}

async function streamOpenRouterModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): Promise<StreamResult> {
  const startedAt = Date.now()
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(35000),
  })

  if (!response.ok) {
    throw new ProviderStreamError(`OpenRouter request failed with ${response.status}`, false, response.status)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new ProviderStreamError('OpenRouter returned an empty response stream.', false)
  }

  const requestId = response.headers.get('x-request-id')
  const decoder = new TextDecoder()
  let buffered = ''
  let assistantMessageContent = ''
  let streamStarted = false
  let usage = normalizeTokenUsage(null, null, null)

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffered += decoder.decode(value, { stream: true })
    const lines = buffered.split('\n')
    buffered = lines.pop() ?? ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') {
        continue
      }

      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(payload) as Record<string, unknown>
      } catch {
        continue
      }

      if (parsed.error) {
        throw new ProviderStreamError('OpenRouter stream returned an error payload.', streamStarted)
      }

      const choices = Array.isArray(parsed.choices) ? parsed.choices : []
      const firstChoice = choices[0] as { delta?: { content?: unknown } } | undefined
      const deltaText = extractOpenRouterDeltaText(firstChoice?.delta?.content)
      if (deltaText) {
        streamStarted = true
        assistantMessageContent += deltaText
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: deltaText })}\n\n`))
      }

      const usagePayload = parsed.usage as { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown } | undefined
      if (usagePayload) {
        usage = normalizeTokenUsage(
          usagePayload.prompt_tokens,
          usagePayload.completion_tokens,
          usagePayload.total_tokens,
        )
      }
    }
  }

  return {
    assistantContent: assistantMessageContent,
    usage,
    requestId,
    latencyMs: Date.now() - startedAt,
    modelUsed: model,
  }
}

async function streamOpenRouterWithFallback(
  apiKey: string,
  requestedModel: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): Promise<StreamResult> {
  const candidates = [requestedModel]
  if (requestedModel !== OPENROUTER_FREE_ROUTER_MODEL) {
    candidates.push(OPENROUTER_FREE_ROUTER_MODEL)
  }

  let lastError: unknown = null
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    try {
      return await streamOpenRouterModel(apiKey, candidate, systemPrompt, messages, controller, encoder)
    } catch (error) {
      lastError = error
      const isFinalCandidate = index === candidates.length - 1
      if (isFinalCandidate) {
        throw error
      }

      if (error instanceof ProviderStreamError) {
        const shouldFallback = !error.streamStarted && (error.status === 429 || (error.status ?? 0) >= 500)
        if (!shouldFallback) {
          throw error
        }
      }
    }
  }

  throw lastError ?? new Error('OpenRouter stream failed.')
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const payload = (await request.json().catch(() => ({}))) as ChatRequestPayload
    const { messages, mode, isGreeting, sessionId } = payload

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userProfile = await ensureUserProfile(userId, session.user.email)

    // Keep heartbeat updated (non-blocking).
    void touchUserLastActiveAt(userId)

    if (userProfile.is_guest && userProfile.guest_expires_at && new Date() > new Date(userProfile.guest_expires_at)) {
      return new Response(JSON.stringify({
        error: 'session_expired',
        message: 'Your guest session has expired. Please log in to continue.',
      }), { status: 403 })
    }

    const supabase = createAdminClient()
    let sessionPreferenceProvider: string | null = null
    let sessionPreferenceModel: string | null = null

    if (sessionId) {
      const { data: ownedSession } = await supabase
        .from('chat_sessions')
        .select('id, provider, model')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle()

      if (ownedSession) {
        sessionPreferenceProvider = ownedSession.provider
        sessionPreferenceModel = ownedSession.model
      }
    }

    const hasAnthropicKey = await hasEncryptedProviderApiKey(userId, 'anthropic')
    const selection = await resolveProviderSelection(
      {
        preferredProvider: payload.provider ?? sessionPreferenceProvider ?? userProfile.default_provider,
        preferredModel: payload.model ?? sessionPreferenceModel ?? userProfile.default_model,
        hasAnthropicKey,
      },
    )

    if (!selection.ok) {
      return new Response(JSON.stringify(selection.failure), {
        status: selection.failure.error === 'provider_unavailable' ? 503 : 403,
      })
    }

    const usingFreeTier = isUsingFreeTier(userProfile)
    if (usingFreeTier) {
      const quotaError = getQuotaError(userProfile)
      if (quotaError) {
        return new Response(JSON.stringify(quotaError), { status: 403 })
      }
    }

    const resolvedProvider = selection.selection.provider
    const resolvedModel = selection.selection.model

    if (resolvedProvider === 'openrouter' && !isOpenRouterFreeModel(resolvedModel)) {
      return new Response(
        JSON.stringify({
          error: 'model_unavailable',
          message: 'Selected OpenRouter model is not available for free-tier usage.',
        }),
        { status: 403 },
      )
    }

    let providerApiKey = ''
    if (resolvedProvider === 'anthropic') {
      const encryptedAnthropicKey = await getEncryptedProviderApiKey(userId, 'anthropic')
      if (!encryptedAnthropicKey) {
        return new Response(JSON.stringify({
          error: 'provider_key_required',
          message: 'Add your Anthropic API key in Settings to use Anthropic models.',
        }), { status: 403 })
      }

      const decrypted = decryptKey(encryptedAnthropicKey)
      if (!decrypted) {
        return new Response(JSON.stringify({
          error: 'invalid_api_key',
          message: 'Your saved API key could not be decrypted. Please re-add it in Settings to continue.',
        }), { status: 403 })
      }
      providerApiKey = decrypted
    } else {
      providerApiKey = process.env.OPENROUTER_API_KEY?.trim() ?? ''
      if (!providerApiKey) {
        return new Response(JSON.stringify({
          error: 'provider_unavailable',
          message: 'OpenRouter is temporarily unavailable. Please try again later.',
        }), { status: 503 })
      }
    }

    const systemPrompt = await buildSystemPrompt(userId, mode, isGreeting)

    let assistantResult: StreamResult | null = null
    let streamClosed = false
    const lastUserMessage = messages[messages.length - 1]
    const encoder = new TextEncoder()

    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          if (resolvedProvider === 'anthropic') {
            assistantResult = await streamAnthropic(
              providerApiKey,
              resolvedModel,
              systemPrompt,
              messages,
              controller,
              encoder,
            )
          } else {
            assistantResult = await streamOpenRouterWithFallback(
              providerApiKey,
              resolvedModel,
              systemPrompt,
              messages,
              controller,
              encoder,
            )
          }

          const usage = assistantResult.usage
          const estimatedCostMicrousd = estimateCostMicrousd(resolvedProvider, assistantResult.modelUsed, usage)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'usage',
                provider: resolvedProvider,
                model: assistantResult.modelUsed,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
                estimatedCostMicrousd,
                latencyMs: assistantResult.latencyMs,
              })}\n\n`,
            ),
          )

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          streamClosed = true

          if (sessionId && lastUserMessage && assistantResult) {
            const usageForPersistence = assistantResult.usage
            const estimatedCostForPersistence = estimateCostMicrousd(resolvedProvider, assistantResult.modelUsed, usageForPersistence)

            const { data: ownedSession } = await supabase
              .from('chat_sessions')
              .select('id')
              .eq('id', sessionId)
              .eq('user_id', userId)
              .maybeSingle()

            if (!ownedSession) {
              return
            }

            await supabase.from('chat_messages').insert({
              session_id: sessionId,
              user_id: userId,
              role: 'user',
              content: lastUserMessage.content,
              provider: resolvedProvider,
              model: assistantResult.modelUsed,
            })

            await supabase.from('chat_messages').insert({
              session_id: sessionId,
              user_id: userId,
              role: 'assistant',
              content: assistantResult.assistantContent,
              provider: resolvedProvider,
              model: assistantResult.modelUsed,
              input_tokens: usageForPersistence.inputTokens,
              output_tokens: usageForPersistence.outputTokens,
              total_tokens: usageForPersistence.totalTokens,
              tokens_used: usageForPersistence.totalTokens,
              latency_ms: assistantResult.latencyMs,
              estimated_cost_microusd: estimatedCostForPersistence,
              request_id: assistantResult.requestId,
            })

            await supabase.rpc('increment_session_messages', {
              session_id_param: sessionId,
              increment_by: 2,
            })

            await supabase.rpc('increment_chat_session_usage', {
              session_id_param: sessionId,
              provider_param: resolvedProvider,
              model_param: assistantResult.modelUsed,
              user_turn_increment: 1,
              input_tokens_increment: usageForPersistence.inputTokens ?? 0,
              output_tokens_increment: usageForPersistence.outputTokens ?? 0,
              total_tokens_increment: usageForPersistence.totalTokens ?? 0,
              cost_increment: estimatedCostForPersistence ?? 0,
            })

            await supabase
              .from('user_profiles')
              .update({
                default_provider: resolvedProvider,
                default_model: assistantResult.modelUsed,
              })
              .eq('id', userId)

            if (usingFreeTier) {
              try {
                await incrementFreeUserMessagesUsed(userId, 1)
              } catch (quotaError) {
                console.error('Failed to increment free quota usage', quotaError)
              }
            }
          }
        } catch (error) {
          if (!streamClosed) {
            console.error('Chat stream failed', error)
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
        Connection: 'keep-alive',
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
