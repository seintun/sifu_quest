import {
  DEFAULT_CHAT_PROVIDER,
  DEFAULT_OPENROUTER_MODEL,
  getAnthropicDefaultModel,
  isChatProvider,
  isKnownAnthropicModel,
  isOpenRouterFreeModel,
  type ChatProvider,
  type OpenRouterModelScope,
  type ProviderKeyMap,
} from './chat-provider-config.ts'

export type ResolvedProviderSelection = {
  provider: ChatProvider
  model: string
}

export type SelectionFailure = {
  error:
    | 'provider_key_required'
    | 'model_unavailable'
    | 'provider_unavailable'
  message: string
}

export type ResolveSelectionInput = {
  preferredProvider?: string | null
  preferredModel?: string | null
  providerKeys: ProviderKeyMap
  openRouterModelScope: OpenRouterModelScope
  userCacheKey?: string | null
  openRouterApiKey?: string | null
  catalogOverride?: {
    modelsByProvider: {
      openrouter: Array<{ id: string }>
      anthropic: Array<{ id: string }>
    }
  }
}

export async function resolveProviderSelection(
  input: ResolveSelectionInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; selection: ResolvedProviderSelection } | { ok: false; failure: SelectionFailure }> {
  const catalog = input.catalogOverride
    ? input.catalogOverride
    : await (async () => {
      const { buildProviderCatalog } = await import('./provider-catalog.ts')
      return buildProviderCatalog(
        {
          providerKeys: input.providerKeys,
          openRouterModelScope: input.openRouterModelScope,
          includeAllOpenRouterModels: true,
          userCacheKey: input.userCacheKey,
          openRouterApiKey: input.openRouterApiKey,
        },
        fetchImpl,
      )
    })()
  const provider = isChatProvider(input.preferredProvider) ? input.preferredProvider : DEFAULT_CHAT_PROVIDER
  const openRouterModelIds = new Set(catalog.modelsByProvider.openrouter.map((m) => m.id))
  const anthropicModelIds = new Set(catalog.modelsByProvider.anthropic.map((m) => m.id))

  if (provider === 'anthropic' && !input.providerKeys.anthropic) {
    return {
      ok: false,
      failure: {
        error: 'provider_key_required',
        message: 'Add your Anthropic API key in Settings to use Anthropic models.',
      },
    }
  }

  if (provider === 'anthropic') {
    const model = typeof input.preferredModel === 'string' ? input.preferredModel.trim() : ''
    if (model.length > 0 && isKnownAnthropicModel(model) && anthropicModelIds.has(model)) {
      return { ok: true, selection: { provider, model } }
    }
    return {
      ok: true,
      selection: {
        provider,
        model: getAnthropicDefaultModel(),
      },
    }
  }

  const openRouterModel = typeof input.preferredModel === 'string' ? input.preferredModel.trim() : ''
  if (openRouterModel.length > 0 && openRouterModelIds.has(openRouterModel)) {
    if (input.openRouterModelScope === 'free_only' && !isOpenRouterFreeModel(openRouterModel)) {
      return {
        ok: false,
        failure: {
          error: 'model_unavailable',
          message: 'Selected OpenRouter model requires your OpenRouter API key in Settings.',
        },
      }
    }
    return {
      ok: true,
      selection: { provider: 'openrouter', model: openRouterModel },
    }
  }

  if (openRouterModel.length > 0 && input.openRouterModelScope === 'free_only' && !isOpenRouterFreeModel(openRouterModel)) {
    return {
      ok: false,
      failure: {
        error: 'model_unavailable',
        message: 'Selected OpenRouter model requires your OpenRouter API key in Settings.',
      },
    }
  }

  return {
    ok: true,
    selection: {
      provider: 'openrouter',
      model: catalog.modelsByProvider.openrouter[0]?.id ?? DEFAULT_OPENROUTER_MODEL,
    },
  }
}
