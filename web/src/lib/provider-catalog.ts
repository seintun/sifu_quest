import 'server-only'
import { unstable_cache } from 'next/cache'

import {
  ANTHROPIC_MODEL_CATALOG,
  type ChatModelDescriptor,
  type ChatProviderDescriptor,
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_STATIC_FREE_MODEL_FALLBACKS,
  sanitizeModelLabel,
} from './chat-provider-config'
import { extractFreeModelIdsFromRankingPayload } from './openrouter-ranking-utils'

const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models'
const OPENROUTER_PROGRAMMING_RANKINGS_URL = 'https://openrouter.ai/rankings?category=programming#categories'
const OPENROUTER_CATALOG_TTL_MS = 5 * 60 * 1000
const OPENROUTER_RANKINGS_TTL_MS = 30 * 60 * 1000

type OpenRouterModelRecord = {
  id?: string
}

type OpenRouterCatalogResponse = {
  data?: OpenRouterModelRecord[]
}

type OpenRouterCache = {
  models: ChatModelDescriptor[]
  expiresAt: number
}

type OpenRouterRankingsCache = {
  modelOrder: string[]
  expiresAt: number
}

let openRouterCache: OpenRouterCache | null = null
let openRouterRankingsCache: OpenRouterRankingsCache | null = null

const getCachedOpenRouterFreeModels = unstable_cache(
  async () => fetchOpenRouterFreeModels(fetch),
  ['openrouter-free-models'],
  { revalidate: 300, tags: ['openrouter-model-catalog'] },
)

const getCachedOpenRouterProgrammingRanking = unstable_cache(
  async () => fetchOpenRouterProgrammingRanking(fetch),
  ['openrouter-programming-ranking'],
  { revalidate: 1800, tags: ['openrouter-model-catalog'] },
)

function buildFallbackOpenRouterModels(): ChatModelDescriptor[] {
  return OPENROUTER_STATIC_FREE_MODEL_FALLBACKS.map((id) => ({
    id,
    label: sanitizeModelLabel(id),
    provider: 'openrouter',
    isFree: true,
    availability: 'available',
  }))
}

function sortAndAnnotateOpenRouterModels(
  models: ChatModelDescriptor[],
  dynamicOrder: readonly string[] = [],
): ChatModelDescriptor[] {
  if (dynamicOrder.length === 0) {
    return models
  }

  const rankById = new Map<string, number>(dynamicOrder.map((id, index) => [id.toLowerCase(), index + 1]))

  const ranked = models
    .map((model) => {
      const rank = rankById.get(model.id.toLowerCase())
      return rank ? { ...model, recommendationRank: rank } : model
    })
    .sort((a, b) => {
      const rankA = a.recommendationRank ?? Number.MAX_SAFE_INTEGER
      const rankB = b.recommendationRank ?? Number.MAX_SAFE_INTEGER
      if (rankA !== rankB) return rankA - rankB
      return a.label.localeCompare(b.label)
    })

  return ranked
}

async function fetchOpenRouterProgrammingRanking(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const fetchOptions: RequestInit = {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(3500),
  }

  try {
    const rscResponse = await fetchImpl(OPENROUTER_PROGRAMMING_RANKINGS_URL, {
      ...fetchOptions,
      headers: { RSC: '1' },
    })

    if (rscResponse.ok) {
      const payload = await rscResponse.text()
      const extracted = extractFreeModelIdsFromRankingPayload(payload)
      if (extracted.length > 0) return extracted
    }

    const htmlResponse = await fetchImpl(OPENROUTER_PROGRAMMING_RANKINGS_URL, fetchOptions)
    if (!htmlResponse.ok) {
      return []
    }

    const payload = await htmlResponse.text()
    return extractFreeModelIdsFromRankingPayload(payload)
  } catch (error) {
    console.warn('OpenRouter programming ranking fetch failed; using static ranking fallback', error)
    return []
  }
}

async function getOpenRouterProgrammingRanking(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  if (fetchImpl === fetch) {
    return getCachedOpenRouterProgrammingRanking()
  }

  const now = Date.now()
  if (openRouterRankingsCache && openRouterRankingsCache.expiresAt > now) {
    return openRouterRankingsCache.modelOrder
  }

  const modelOrder = await fetchOpenRouterProgrammingRanking(fetchImpl)
  openRouterRankingsCache = {
    modelOrder,
    expiresAt: now + OPENROUTER_RANKINGS_TTL_MS,
  }
  return modelOrder
}

async function fetchOpenRouterFreeModels(fetchImpl: typeof fetch = fetch): Promise<ChatModelDescriptor[]> {
  try {
    const response = await fetchImpl(OPENROUTER_MODELS_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter catalog request failed with ${response.status}`)
    }

    const payload = (await response.json()) as OpenRouterCatalogResponse
    const seen = new Set<string>()

    const freeModels = (payload.data ?? [])
      .map((record) => (typeof record.id === 'string' ? record.id.trim() : ''))
      .filter((id) => id.length > 0 && id.endsWith(':free'))
      .filter((id) => {
        if (seen.has(id)) {
          return false
        }
        seen.add(id)
        return true
      })
      .map<ChatModelDescriptor>((id) => ({
        id,
        label: sanitizeModelLabel(id),
        provider: 'openrouter',
        isFree: true,
        availability: 'available',
      }))

    if (freeModels.length === 0) {
      return buildFallbackOpenRouterModels()
    }

    return freeModels
  } catch (error) {
    console.warn('Falling back to static OpenRouter free model catalog', error)
    return buildFallbackOpenRouterModels()
  }
}

export async function getOpenRouterFreeModels(fetchImpl: typeof fetch = fetch): Promise<ChatModelDescriptor[]> {
  if (fetchImpl === fetch) {
    return getCachedOpenRouterFreeModels()
  }

  const now = Date.now()
  if (openRouterCache && openRouterCache.expiresAt > now) {
    return openRouterCache.models
  }

  const models = await fetchOpenRouterFreeModels(fetchImpl)
  openRouterCache = {
    models,
    expiresAt: now + OPENROUTER_CATALOG_TTL_MS,
  }
  return models
}

export type ProviderCatalogResult = {
  providers: ChatProviderDescriptor[]
  modelsByProvider: Record<'openrouter' | 'anthropic', ChatModelDescriptor[]>
  defaults: {
    provider: 'openrouter' | 'anthropic'
    model: string
  }
}

export async function buildProviderCatalog(
  hasAnthropicKey: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderCatalogResult> {
  const [openRouterModels, dynamicProgrammingOrder] = await Promise.all([
    getOpenRouterFreeModels(fetchImpl),
    getOpenRouterProgrammingRanking(fetchImpl),
  ])
  const rankedOpenRouterModels = sortAndAnnotateOpenRouterModels(openRouterModels, dynamicProgrammingOrder)
  const anthropicModels = ANTHROPIC_MODEL_CATALOG.map<ChatModelDescriptor>((model) => ({
    id: model.id,
    label: model.label,
    provider: 'anthropic',
    isFree: false,
    availability: hasAnthropicKey ? 'available' : 'requires_key',
    reason: hasAnthropicKey ? undefined : 'Add Anthropic BYOK in Settings for unlimited AI chat.',
  }))

  return {
    providers: [
      {
        id: 'openrouter',
        label: 'OpenRouter',
        availability: 'available',
      },
      {
        id: 'anthropic',
        label: 'Anthropic',
        availability: hasAnthropicKey ? 'available' : 'requires_key',
        reason: hasAnthropicKey ? undefined : 'Add Anthropic BYOK in Settings for unlimited AI chat.',
      },
    ],
    modelsByProvider: {
      openrouter: rankedOpenRouterModels,
      anthropic: anthropicModels,
    },
    defaults: {
      provider: 'openrouter',
      model: rankedOpenRouterModels[0]?.id ?? DEFAULT_OPENROUTER_MODEL,
    },
  }
}
