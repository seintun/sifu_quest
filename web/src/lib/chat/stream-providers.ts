import Anthropic from '@anthropic-ai/sdk'
import { normalizeTokenUsage, parseUsdToMicrousd, type TokenUsage } from '@/lib/chat-usage'
import { OPENROUTER_FREE_ROUTER_MODEL } from '@/lib/chat-provider-config'

export type StreamResult = {
  assistantContent: string
  usage: TokenUsage
  providerReportedCostMicrousd: number | null
  requestId: string | null
  latencyMs: number
  modelUsed: string
}

export class ProviderStreamError extends Error {
  streamStarted: boolean
  status?: number

  constructor(message: string, streamStarted: boolean, status?: number) {
    super(message)
    this.name = 'ProviderStreamError'
    this.streamStarted = streamStarted
    this.status = status
  }
}

export class ClientStreamClosedError extends Error {
  constructor() {
    super('Client stream is already closed.')
    this.name = 'ClientStreamClosedError'
  }
}

export function isControllerAlreadyClosedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const maybeCode = (error as Error & { code?: string }).code
  return maybeCode === 'ERR_INVALID_STATE' || error.message.includes('Controller is already closed')
}

export function enqueueSseFrame(
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

export function closeSseStream(controller: ReadableStreamDefaultController<Uint8Array>): void {
  try {
    controller.close()
  } catch (error) {
    if (!isControllerAlreadyClosedError(error)) {
      throw error
    }
  }
}

export function extractOpenRouterDeltaText(delta: unknown): string {
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

export async function streamAnthropic(
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

export async function streamOpenRouterModel(
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

export async function streamOpenRouterWithFallback(
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
        // Fallback on: rate limit (429), server errors (5xx), model not found (404)
        const shouldFallback = !error.streamStarted && (
          error.status === 404 ||
          error.status === 429 ||
          (error.status ?? 0) >= 500
        )
        if (!shouldFallback) {
          throw error
        }
      }
    }
  }

  throw lastError ?? new Error('OpenRouter stream failed.')
}
