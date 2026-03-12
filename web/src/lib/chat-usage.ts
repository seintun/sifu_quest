import type { ChatProvider } from './chat-provider-config'

export type TokenUsage = {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

export type SessionUsageDelta = TokenUsage & {
  estimatedCostMicrousd: number | null
  latencyMs: number | null
}

type Pricing = {
  inputUsdPerMillion: number
  outputUsdPerMillion: number
}

const ANTHROPIC_PRICING_BY_MODEL_PREFIX: ReadonlyArray<{ prefix: string; pricing: Pricing }> = [
  { prefix: 'claude-opus-4-6', pricing: { inputUsdPerMillion: 5, outputUsdPerMillion: 25 } },
  { prefix: 'claude-opus-4-5', pricing: { inputUsdPerMillion: 5, outputUsdPerMillion: 25 } },
  { prefix: 'claude-opus-4-1', pricing: { inputUsdPerMillion: 15, outputUsdPerMillion: 75 } },
  { prefix: 'claude-opus-4', pricing: { inputUsdPerMillion: 15, outputUsdPerMillion: 75 } },
  { prefix: 'claude-opus-3', pricing: { inputUsdPerMillion: 15, outputUsdPerMillion: 75 } },
  { prefix: 'claude-sonnet-4-6', pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } },
  { prefix: 'claude-sonnet-4-5', pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } },
  { prefix: 'claude-sonnet-4', pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } },
  { prefix: 'claude-sonnet-3-7', pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } },
  { prefix: 'claude-haiku-4-5', pricing: { inputUsdPerMillion: 1, outputUsdPerMillion: 5 } },
  { prefix: 'claude-haiku-3-5', pricing: { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 } },
  { prefix: 'claude-haiku-3', pricing: { inputUsdPerMillion: 0.25, outputUsdPerMillion: 1.25 } },
  { prefix: 'claude-3-5-haiku', pricing: { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 } },
] as const

function toNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.floor(value)
}

export function parseUsdToMicrousd(value: unknown): number | null {
  let numericValue: number | null = null
  if (typeof value === 'number' && Number.isFinite(value)) {
    numericValue = value
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      const parsed = Number(trimmed)
      if (Number.isFinite(parsed)) {
        numericValue = parsed
      }
    }
  }

  if (numericValue === null || numericValue < 0) {
    return null
  }

  return Math.round(numericValue * 1_000_000)
}

export function normalizeTokenUsage(inputTokens: unknown, outputTokens: unknown, totalTokens: unknown): TokenUsage {
  const normalizedInput = toNumberOrNull(inputTokens)
  const normalizedOutput = toNumberOrNull(outputTokens)
  const normalizedTotal = toNumberOrNull(totalTokens)

  if (normalizedTotal !== null) {
    return {
      inputTokens: normalizedInput,
      outputTokens: normalizedOutput,
      totalTokens: normalizedTotal,
    }
  }

  if (normalizedInput !== null || normalizedOutput !== null) {
    return {
      inputTokens: normalizedInput,
      outputTokens: normalizedOutput,
      totalTokens: (normalizedInput ?? 0) + (normalizedOutput ?? 0),
    }
  }

  return {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
  }
}

function getAnthropicPricing(model: string): Pricing | null {
  const normalized = model.toLowerCase()
  for (const candidate of ANTHROPIC_PRICING_BY_MODEL_PREFIX) {
    if (normalized.startsWith(candidate.prefix)) {
      return candidate.pricing
    }
  }
  return null
}

export function estimateCostMicrousd(provider: ChatProvider, model: string, usage: TokenUsage): number | null {
  if (usage.totalTokens === null) {
    return null
  }

  // OpenRouter free models are treated as zero-cost for this telemetry surface.
  if (provider === 'openrouter') {
    return 0
  }

  const pricing = getAnthropicPricing(model)
  if (!pricing) {
    return null
  }

  const input = usage.inputTokens ?? 0
  const output = usage.outputTokens ?? Math.max(0, usage.totalTokens - input)

  const inputUsd = (input / 1_000_000) * pricing.inputUsdPerMillion
  const outputUsd = (output / 1_000_000) * pricing.outputUsdPerMillion
  return Math.round((inputUsd + outputUsd) * 1_000_000)
}
