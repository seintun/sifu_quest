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

const OPENROUTER_MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models'
const OPENROUTER_CATALOG_TTL_MS = 5 * 60 * 1000

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

let openRouterCache: OpenRouterCache | null = null

const getCachedOpenRouterFreeModels = unstable_cache(
  async () => fetchOpenRouterFreeModels(fetch),
  ['openrouter-free-models'],
  { revalidate: 300, tags: ['openrouter-model-catalog'] },
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
  const openRouterModels = await getOpenRouterFreeModels(fetchImpl)
  const anthropicModels = ANTHROPIC_MODEL_CATALOG.map<ChatModelDescriptor>((model) => ({
    id: model.id,
    label: model.label,
    provider: 'anthropic',
    isFree: false,
    availability: hasAnthropicKey ? 'available' : 'requires_key',
    reason: hasAnthropicKey ? undefined : 'Add your Anthropic API key in Settings to use Anthropic models.',
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
        reason: hasAnthropicKey ? undefined : 'Add your Anthropic API key in Settings to enable Anthropic models.',
      },
    ],
    modelsByProvider: {
      openrouter: openRouterModels,
      anthropic: anthropicModels,
    },
    defaults: {
      provider: 'openrouter',
      model: openRouterModels[0]?.id ?? DEFAULT_OPENROUTER_MODEL,
    },
  }
}
