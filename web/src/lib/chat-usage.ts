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
  { prefix: 'claude-opus', pricing: { inputUsdPerMillion: 15, outputUsdPerMillion: 75 } },
  { prefix: 'claude-sonnet', pricing: { inputUsdPerMillion: 3, outputUsdPerMillion: 15 } },
  { prefix: 'claude-haiku', pricing: { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 } },
  { prefix: 'claude-3-5-haiku', pricing: { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 } },
] as const

function toNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.floor(value)
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
