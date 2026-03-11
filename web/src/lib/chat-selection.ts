import {
  DEFAULT_CHAT_PROVIDER,
  DEFAULT_OPENROUTER_MODEL,
  getAnthropicDefaultModel,
  isChatProvider,
  isKnownAnthropicModel,
  isOpenRouterFreeModel,
  type ChatProvider,
} from './chat-provider-config'
import { buildProviderCatalog } from './provider-catalog'

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

type ResolveSelectionInput = {
  preferredProvider?: string | null
  preferredModel?: string | null
  hasAnthropicKey: boolean
}

export async function resolveProviderSelection(
  input: ResolveSelectionInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; selection: ResolvedProviderSelection } | { ok: false; failure: SelectionFailure }> {
  const catalog = await buildProviderCatalog(input.hasAnthropicKey, fetchImpl)
  const provider = isChatProvider(input.preferredProvider) ? input.preferredProvider : DEFAULT_CHAT_PROVIDER
  const openRouterModelIds = new Set(catalog.modelsByProvider.openrouter.map((m) => m.id))
  const anthropicModelIds = new Set(catalog.modelsByProvider.anthropic.map((m) => m.id))

  if (provider === 'anthropic' && !input.hasAnthropicKey) {
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
  if (openRouterModel.length > 0 && isOpenRouterFreeModel(openRouterModel) && openRouterModelIds.has(openRouterModel)) {
    return {
      ok: true,
      selection: { provider: 'openrouter', model: openRouterModel },
    }
  }

  if (openRouterModel.length > 0 && !isOpenRouterFreeModel(openRouterModel)) {
    return {
      ok: false,
      failure: {
        error: 'model_unavailable',
        message: 'Selected OpenRouter model is not available on the free tier for this account.',
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
