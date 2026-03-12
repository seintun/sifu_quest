import { auth } from '@/auth'
import { decryptKey } from '@/lib/apikey'
import { ensureUserProfile, touchUserLastActiveAt } from '@/lib/account-state'
import { sanitizeIncomingChatMessages } from '@/lib/chat-message-sanitizer'
import { loadChatEntitlements } from '@/lib/chat-entitlements'
import { estimateCostMicrousd, normalizeTokenUsage, parseUsdToMicrousd, type TokenUsage } from '@/lib/chat-usage'
import {
  isMissingMessageTelemetryColumnError,
  isMissingSessionTelemetryColumnError,
  isMissingSessionUsageRpcError,
} from '@/lib/chat-schema-compat'
import { resolveProviderSelection } from '@/lib/chat-selection'
import {
  OPENROUTER_FREE_ROUTER_MODEL,
  isOpenRouterFreeModel,
  type ChatProvider,
} from '@/lib/chat-provider-config'
import { getQuotaError, incrementFreeUserMessagesUsed, shouldEnforceProviderQuota } from '@/lib/free-quota'
import { readMemoryFiles, readModeFile } from '@/lib/memory'
import { getEncryptedProviderApiKey } from '@/lib/provider-api-keys'
import { buildSifuMasterToneGuidelines } from '@/lib/brand'
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

type StreamResult = {
  assistantContent: string
  usage: TokenUsage
  providerReportedCostMicrousd: number | null
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

class ClientStreamClosedError extends Error {
  constructor() {
    super('Client stream is already closed.')
    this.name = 'ClientStreamClosedError'
  }
}

function isControllerAlreadyClosedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const maybeCode = (error as Error & { code?: string }).code
  return maybeCode === 'ERR_INVALID_STATE' || error.message.includes('Controller is already closed')
}

function enqueueSseFrame(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: string,
): void {
  try {
    controller.enqueue(encoder.encode(payload))
  } catch (error) {
    if (isControllerAlreadyClosedError(error)) {
      throw new ClientStreamClosedError()
    }
    throw error
  }
}

function closeSseStream(controller: ReadableStreamDefaultController<Uint8Array>): void {
  try {
    controller.close()
  } catch (error) {
    if (!isControllerAlreadyClosedError(error)) {
      throw error
    }
  }
}

function isMissingRpcFunctionError(
  error: { code?: string; message?: string } | null | undefined,
  functionName: string,
): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || Boolean(error.message?.includes(functionName)) || Boolean(error.message?.includes('Could not find the function'))
}

function resolveCostMicrousd(
  provider: ChatProvider,
  model: string,
  usage: TokenUsage,
  providerReportedCostMicrousd: number | null,
): number | null {
  return providerReportedCostMicrousd ?? estimateCostMicrousd(provider, model, usage)
}

type PersistTurnInput = {
  supabase: ReturnType<typeof createAdminClient>
  sessionId: string
  userId: string
  userContent: string
  assistantContent: string
  provider: ChatProvider
  model: string
  usage: TokenUsage
  latencyMs: number
  estimatedCostMicrousd: number | null
  requestId: string | null
  enforceQuota: boolean
}

async function persistChatTurnLegacy(input: PersistTurnInput): Promise<void> {
  const {
    supabase,
    sessionId,
    userId,
    userContent,
    assistantContent,
    provider,
    model,
    usage,
    latencyMs,
    estimatedCostMicrousd,
    requestId,
    enforceQuota,
  } = input

  const { data: ownedSession } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!ownedSession) {
    return
  }

  const { error: userInsertError } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'user',
    content: userContent,
    provider,
    model,
  })
  if (userInsertError) {
    if (!isMissingMessageTelemetryColumnError(userInsertError)) {
      console.error('Failed to persist user chat message', userInsertError)
    }
    return
  }

  const { error: assistantInsertError } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: userId,
    role: 'assistant',
    content: assistantContent,
    provider,
    model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    total_tokens: usage.totalTokens,
    tokens_used: usage.totalTokens,
    latency_ms: latencyMs,
    estimated_cost_microusd: estimatedCostMicrousd,
    request_id: requestId,
  })
  if (assistantInsertError) {
    if (!isMissingMessageTelemetryColumnError(assistantInsertError)) {
      console.error('Failed to persist assistant chat message', assistantInsertError)
    }
    return
  }

  const { error: incrementSessionMessagesError } = await supabase.rpc('increment_session_messages', {
    session_id_param: sessionId,
    increment_by: 2,
  })
  if (incrementSessionMessagesError && !isMissingSessionTelemetryColumnError(incrementSessionMessagesError)) {
    console.error('Failed to increment session messages via RPC', incrementSessionMessagesError)
  }

  const { error: incrementChatSessionUsageError } = await supabase.rpc('increment_chat_session_usage', {
    session_id_param: sessionId,
    provider_param: provider,
    model_param: model,
    user_turn_increment: 1,
    input_tokens_increment: usage.inputTokens ?? 0,
    output_tokens_increment: usage.outputTokens ?? 0,
    total_tokens_increment: usage.totalTokens ?? 0,
    cost_increment: estimatedCostMicrousd ?? 0,
  })
  if (incrementChatSessionUsageError && !isMissingSessionUsageRpcError(incrementChatSessionUsageError)) {
    console.error('Failed to increment chat session usage via RPC', incrementChatSessionUsageError)
  }

  const { data: currentDefaults, error: profileDefaultsError } = await supabase
    .from('user_profiles')
    .select('default_provider, default_model')
    .eq('id', userId)
    .maybeSingle()

  if (profileDefaultsError) {
    console.warn('Unable to load current default provider/model on profile', profileDefaultsError)
  } else {
    const shouldUpdateDefaults = currentDefaults?.default_provider !== provider || currentDefaults?.default_model !== model

    if (shouldUpdateDefaults) {
      const { error: profileUpdateError } = await supabase
        .from('user_profiles')
        .update({
          default_provider: provider,
          default_model: model,
        })
        .eq('id', userId)
      if (profileUpdateError) {
        console.warn('Unable to persist default provider/model on profile', profileUpdateError)
      }
    }
  }

  if (enforceQuota) {
    try {
      await incrementFreeUserMessagesUsed(userId, 1)
    } catch (quotaError) {
      console.error('Failed to increment free quota usage', quotaError)
    }
  }
}

async function persistChatTurn(input: PersistTurnInput): Promise<void> {
  const {
    supabase,
    sessionId,
    userId,
    userContent,
    assistantContent,
    provider,
    model,
    usage,
    latencyMs,
    estimatedCostMicrousd,
    requestId,
    enforceQuota,
  } = input

  const { data, error } = await supabase.rpc('persist_chat_turn', {
    session_id_param: sessionId,
    user_id_param: userId,
    user_content_param: userContent,
    assistant_content_param: assistantContent,
    provider_param: provider,
    model_param: model,
    input_tokens_param: usage.inputTokens ?? 0,
    output_tokens_param: usage.outputTokens ?? 0,
    total_tokens_param: usage.totalTokens ?? 0,
    latency_ms_param: latencyMs,
    estimated_cost_param: estimatedCostMicrousd ?? 0,
    request_id_param: requestId,
  })

  if (error) {
    if (isMissingRpcFunctionError(error, 'persist_chat_turn')) {
      await persistChatTurnLegacy(input)
      return
    }
    throw new Error(error.message)
  }

  if (!data) {
    return
  }

  if (enforceQuota) {
    try {
      await incrementFreeUserMessagesUsed(userId, 1)
    } catch (quotaError) {
      console.error('Failed to increment free quota usage', quotaError)
    }
  }
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
      enqueueSseFrame(controller, encoder, `data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
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
    providerReportedCostMicrousd: null,
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
  let providerReportedCostMicrousd: number | null = null

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
        enqueueSseFrame(controller, encoder, `data: ${JSON.stringify({ text: deltaText })}\n\n`)
      }

      const usagePayload = parsed.usage as {
        prompt_tokens?: unknown
        completion_tokens?: unknown
        total_tokens?: unknown
        cost?: unknown
        total_cost?: unknown
      } | undefined
      if (usagePayload) {
        usage = normalizeTokenUsage(
          usagePayload.prompt_tokens,
          usagePayload.completion_tokens,
          usagePayload.total_tokens,
        )
        const liveCostMicrousd = parseUsdToMicrousd(usagePayload.cost) ?? parseUsdToMicrousd(usagePayload.total_cost)
        if (liveCostMicrousd !== null) {
          providerReportedCostMicrousd = liveCostMicrousd
        }
      }
    }
  }

  return {
    assistantContent: assistantMessageContent,
    usage,
    providerReportedCostMicrousd,
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
      if (error instanceof ClientStreamClosedError) {
        throw error
      }
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
      const sharedOpenRouterKey = process.env.OPENROUTER_API_KEY?.trim() ?? ''
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
            const usageForPersistence = assistantResult.usage
            const persistInput: PersistTurnInput = {
              supabase,
              sessionId,
              userId,
              userContent: lastUserMessage.content,
              assistantContent: assistantResult.assistantContent,
              provider: resolvedProvider,
              model: assistantResult.modelUsed,
              usage: usageForPersistence,
              latencyMs: assistantResult.latencyMs,
              estimatedCostMicrousd: resolveCostMicrousd(
                resolvedProvider,
                assistantResult.modelUsed,
                usageForPersistence,
                assistantResult.providerReportedCostMicrousd,
              ),
              requestId: assistantResult.requestId,
              enforceQuota,
            }

            // Persistence is intentionally fire-and-forget after stream close to keep response path non-blocking.
            void persistChatTurn(persistInput).catch((persistError) => {
              console.error('Post-stream persistence failed', {
                sessionId,
                userId,
                provider: resolvedProvider,
                model: assistantResult?.modelUsed,
                requestId: assistantResult?.requestId,
                error: persistError,
              })
            })
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
