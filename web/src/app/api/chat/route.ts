import { auth } from '@/auth'
import { decryptKey } from '@/lib/apikey'
import { ensureUserProfile, touchUserLastActiveAt } from '@/lib/account-state'
import { sanitizeIncomingChatMessages } from '@/lib/chat-message-sanitizer'
import { loadChatEntitlements } from '@/lib/chat-entitlements'
import {
  isMissingSessionTelemetryColumnError,
} from '@/lib/chat-schema-compat'
import { resolveProviderSelection } from '@/lib/chat-selection'
import {
  isOpenRouterFreeModel,
} from '@/lib/chat-provider-config'
import { getQuotaError, shouldEnforceProviderQuota } from '@/lib/free-quota'
import { readMemoryFiles, readModeFile } from '@/lib/memory'
import { getEncryptedProviderApiKey } from '@/lib/provider-api-keys'
import { buildSifuMasterToneGuidelines } from '@/lib/brand'
import { createAdminClient } from '@/lib/supabase-admin'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { checkRateLimit, CHAT_RATE_LIMIT } from '@/lib/rate-limiter'
import { NextRequest } from 'next/server'

import {
  type StreamResult,
  ClientStreamClosedError,
  enqueueSseFrame,
  closeSseStream,
  streamAnthropic,
  streamOpenRouterWithFallback,
} from '@/lib/chat/stream-providers'

import { chatPostSchema, validationErrorResponse } from '@/lib/api-validation'

import {
  type PersistTurnInput,
  persistChatTurn,
  resolveCostMicrousd,
} from '@/lib/chat/chat-persistence'

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

function getEnrichmentCoachQuestion(promptKey: string | null): string | null {
  switch (promptKey) {
    case 'techStack':
      return 'Before we start, what is your primary tech stack right now?'
    case 'targetCompanies':
      return 'Before we start, what companies or company tiers are you targeting most?'
    case 'learningStyle':
      return 'Before we start, how do you prefer to learn during prep sessions?'
    case 'strengths':
      return 'Before we start, what are your strongest technical areas today?'
    default:
      return null
  }
}

type ChatRequestPayload = {
  messages?: Array<{ role: string; content: string }>
  mode?: string
  isGreeting?: boolean
  sessionId?: string | null
  provider?: string
  model?: string
}

async function buildSystemPrompt(
  userId: string,
  mode: string | undefined,
  isGreeting: boolean | undefined,
): Promise<string> {
  let systemPrompt = 'You are Sifu, the master coach for coding and programming.'
  const modeConfig = MODE_TO_FILES[mode || 'dsa']

  if (!modeConfig) {
    if (isGreeting) {
      systemPrompt += '\n\n---\n## Greeting Instruction\n\nThe user just opened this mastery mode. Write a warm, concise welcome (2-4 sentences) in Sifu tone. End with one open question to kick off the session.'
    }
    return systemPrompt
  }

  const [modeContent, memoryByFile] = await Promise.all([
    readModeFile(modeConfig.mode),
    readMemoryFiles(userId, modeConfig.memory),
  ])

  if (modeContent) {
    systemPrompt = modeContent
  }
  systemPrompt += `\n\n---\n${buildSifuMasterToneGuidelines()}`

  const memoryParts: string[] = []
  const profileContent = memoryByFile['profile.md'] ?? ''
  for (const memFile of modeConfig.memory) {
    const content = memoryByFile[memFile] ?? ''
    if (content) {
      memoryParts.push(`### ${memFile}\n${content}`)
    }
  }

  if (memoryParts.length > 0) {
    systemPrompt += '\n\n---\n## Current Memory Context\n\n' + memoryParts.join('\n\n')
  }

  if (isGreeting) {
    let enrichmentQuestion: string | null = null
    try {
      const supabaseAdmin = createAdminClient()
      const { data } = await supabaseAdmin
        .from('user_profiles')
        .select('onboarding_status, onboarding_next_prompt_key')
        .eq('id', userId)
        .maybeSingle()
      if (data?.onboarding_status === 'core_complete') {
        enrichmentQuestion = getEnrichmentCoachQuestion(data.onboarding_next_prompt_key)
      }
    } catch {
      // No-op: greeting can continue without enrichment prompt.
    }

    const nameMatch = profileContent.match(/\*\*Name:\*\*\s*(.+)/)
    const userName = nameMatch ? nameMatch[1].trim() : null
    const nameInstruction = userName
      ? `Greet the user as "${userName}" — this name comes directly from their memory profile.`
      : 'No name found in memory — use a neutral greeting without fabricating a name.'
    const enrichmentInstruction = enrichmentQuestion
      ? `After the welcome, ask exactly one onboarding enrichment question: "${enrichmentQuestion}" Do not ask additional questions in the same message.`
      : 'End with one open question to kick off the session.'
    systemPrompt += `\n\n---\n## Greeting Instruction\n\nThe user just opened this mastery mode. Write a warm, concise welcome (2-4 sentences) in Sifu tone. ${nameInstruction} Reference their past progress from memory if relevant. ${enrichmentInstruction}`
  }

  return systemPrompt
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)

    // Rate limiting: 30 requests per minute per user
    const rateLimitResult = checkRateLimit(userId, CHAT_RATE_LIMIT)
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'rate_limited',
          message: 'Too many requests. Please wait a moment before sending another message.',
          retryAfterMs: rateLimitResult.retryAfterMs,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(rateLimitResult.retryAfterMs / 1000)),
          },
        },
      )
    }

    const rawPayload = await request.json().catch(() => ({}))
    const parsed = chatPostSchema.safeParse(rawPayload)
    if (!parsed.success) {
      return new Response(JSON.stringify(validationErrorResponse(parsed.error)), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payload = parsed.data as ChatRequestPayload
    const { mode, isGreeting, sessionId } = payload
    const sanitizedMessages = sanitizeIncomingChatMessages(payload.messages)
    if (sanitizedMessages.length === 0) {
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
      const { data: ownedSession, error: ownedSessionError } = await supabase
        .from('chat_sessions')
        .select('id, provider, model')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle()

      if (ownedSessionError) {
        if (isMissingSessionTelemetryColumnError(ownedSessionError)) {
          const { data: legacyOwnedSession, error: legacyOwnedSessionError } = await supabase
            .from('chat_sessions')
            .select('id')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .maybeSingle()

          if (legacyOwnedSessionError) {
            return new Response(JSON.stringify({
              error: 'chat_unavailable',
              message: CHAT_UNAVAILABLE_MESSAGE,
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          if (legacyOwnedSession) {
            sessionPreferenceProvider = null
            sessionPreferenceModel = null
          }
        } else {
          return new Response(JSON.stringify({
            error: 'chat_unavailable',
            message: CHAT_UNAVAILABLE_MESSAGE,
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      } else if (ownedSession) {
        sessionPreferenceProvider = ownedSession.provider
        sessionPreferenceModel = ownedSession.model
      }
    }

    const entitlements = await loadChatEntitlements(userId)
    const encryptedOpenRouterKey = entitlements.providerKeys.openrouter
      ? await getEncryptedProviderApiKey(userId, 'openrouter')
      : null
    const decryptedOpenRouterKey = encryptedOpenRouterKey ? decryptKey(encryptedOpenRouterKey) : null
    const selection = await resolveProviderSelection(
      {
        preferredProvider: payload.provider ?? sessionPreferenceProvider ?? userProfile.default_provider,
        preferredModel: payload.model ?? sessionPreferenceModel ?? userProfile.default_model,
        providerKeys: entitlements.providerKeys,
        openRouterModelScope: entitlements.openRouterModelScope,
        userCacheKey: userId,
        openRouterApiKey: decryptedOpenRouterKey,
      },
    )

    if (!selection.ok) {
      return new Response(JSON.stringify(selection.failure), {
        status: selection.failure.error === 'provider_unavailable' ? 503 : 403,
      })
    }

    const resolvedProvider = selection.selection.provider
    const resolvedModel = selection.selection.model
    const enforceQuota = shouldEnforceProviderQuota(
      { ...userProfile, has_provider_key: entitlements.hasAnyProviderKey },
      resolvedProvider,
      entitlements.providerKeys,
    )

    if (enforceQuota) {
      const quotaError = getQuotaError({ ...userProfile, has_provider_key: entitlements.hasAnyProviderKey })
      if (quotaError) {
        return new Response(JSON.stringify(quotaError), { status: 403 })
      }
    }

    if (resolvedProvider === 'openrouter' && entitlements.openRouterModelScope === 'free_only' && !isOpenRouterFreeModel(resolvedModel)) {
      return new Response(
        JSON.stringify({
          error: 'model_unavailable',
          message: 'Selected OpenRouter model requires your OpenRouter API key in Settings.',
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
      const sharedOpenRouterKey = process.env.SIFU_OPENROUTER_API_KEY?.trim() ?? ''
      const canFallbackToSharedFreeModel = sharedOpenRouterKey.length > 0 && isOpenRouterFreeModel(resolvedModel)

      if (encryptedOpenRouterKey && !decryptedOpenRouterKey && !canFallbackToSharedFreeModel) {
        return new Response(JSON.stringify({
          error: 'invalid_api_key',
          message: 'Your saved OpenRouter API key could not be decrypted. Please re-add it in Settings to continue.',
        }), { status: 403 })
      }
      providerApiKey = decryptedOpenRouterKey?.trim() ?? sharedOpenRouterKey
      if (!providerApiKey) {
        return new Response(JSON.stringify({
          error: 'provider_unavailable',
          message: 'OpenRouter is temporarily unavailable. Please try again later.',
        }), { status: 503 })
      }
    }

    let assistantResult: StreamResult | null = null
    let streamClosed = false
    const lastUserMessage = [...sanitizedMessages].reverse().find((message) => message.role === 'user') ?? null
    const encoder = new TextEncoder()

    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          enqueueSseFrame(
            controller,
            encoder,
            `data: ${JSON.stringify({ type: 'status', status: 'thinking' })}\n\n`,
          )

          const systemPrompt = await buildSystemPrompt(userId, mode, isGreeting)

          if (resolvedProvider === 'anthropic') {
            assistantResult = await streamAnthropic(
              providerApiKey,
              resolvedModel,
              systemPrompt,
              sanitizedMessages,
              controller,
              encoder,
            )
          } else {
            assistantResult = await streamOpenRouterWithFallback(
              providerApiKey,
              resolvedModel,
              systemPrompt,
              sanitizedMessages,
              controller,
              encoder,
            )
          }

          const usage = assistantResult.usage
          const estimatedCostMicrousd = resolveCostMicrousd(
            resolvedProvider,
            assistantResult.modelUsed,
            usage,
            assistantResult.providerReportedCostMicrousd,
          )
          enqueueSseFrame(
            controller,
            encoder,
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
          )

          enqueueSseFrame(controller, encoder, 'data: [DONE]\n\n')
          closeSseStream(controller)
          streamClosed = true

          if (sessionId && lastUserMessage && assistantResult) {
            const persistInput: PersistTurnInput = {
              supabase,
              sessionId,
              userId,
              userContent: lastUserMessage.content,
              assistantContent: assistantResult.assistantContent,
              provider: resolvedProvider,
              model: assistantResult.modelUsed,
              usage,
              latencyMs: assistantResult.latencyMs,
              estimatedCostMicrousd, // Reuse from SSE frame
              requestId: assistantResult.requestId,
              enforceQuota,
            }

            try {
              await persistChatTurn(persistInput)
            } catch (persistError) {
              console.error('Post-stream persistence failed', {
                sessionId,
                userId,
                provider: resolvedProvider,
                model: assistantResult?.modelUsed,
                requestId: assistantResult?.requestId,
                error: persistError,
              })
            }
          }
        } catch (error) {
          if (error instanceof ClientStreamClosedError) {
            streamClosed = true
            return
          }

          if (!streamClosed) {
            console.error('Chat stream failed', error)
            try {
              enqueueSseFrame(controller, encoder, `data: ${JSON.stringify({ error: CHAT_STREAM_ERROR_MESSAGE })}\n\n`)
            } catch (streamWriteError) {
              if (!(streamWriteError instanceof ClientStreamClosedError)) {
                console.error('Failed to write stream error payload', streamWriteError)
              }
            }
            closeSseStream(controller)
            return
          }
          console.error('Unexpected post-close stream error', {
            sessionId,
            userId,
            provider: resolvedProvider,
            model: resolvedModel,
            error,
          })
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
