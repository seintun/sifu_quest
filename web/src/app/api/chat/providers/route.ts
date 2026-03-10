import { auth } from '@/auth'
import { ensureUserProfile } from '@/lib/account-state'
import {
  DEFAULT_CHAT_PROVIDER,
  DEFAULT_OPENROUTER_MODEL,
  getAnthropicDefaultModel,
  isKnownAnthropicModel,
  isOpenRouterFreeModel,
  type ChatProvider,
} from '@/lib/chat-provider-config'
import { buildProviderCatalog } from '@/lib/provider-catalog'
import { hasEncryptedProviderApiKey } from '@/lib/provider-api-keys'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

function resolveDefaultProvider(
  preferredProvider: ChatProvider,
  hasAnthropicKey: boolean,
): ChatProvider {
  if (preferredProvider === 'anthropic' && !hasAnthropicKey) {
    return DEFAULT_CHAT_PROVIDER
  }
  return preferredProvider
}

function resolveDefaultModel(
  provider: ChatProvider,
  preferredModel: string | null,
  hasAnthropicKey: boolean,
  openRouterModels: string[],
): string {
  if (provider === 'anthropic') {
    if (!hasAnthropicKey) {
      return openRouterModels[0] ?? DEFAULT_OPENROUTER_MODEL
    }
    if (preferredModel && isKnownAnthropicModel(preferredModel)) {
      return preferredModel
    }
    return getAnthropicDefaultModel()
  }

  if (preferredModel && isOpenRouterFreeModel(preferredModel) && openRouterModels.includes(preferredModel)) {
    return preferredModel
  }
  return openRouterModels[0] ?? DEFAULT_OPENROUTER_MODEL
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const profile = await ensureUserProfile(userId, session.user.email)
    const hasAnthropicKey = await hasEncryptedProviderApiKey(userId, 'anthropic')
    const catalog = await buildProviderCatalog(hasAnthropicKey)
    const openRouterModelIds = catalog.modelsByProvider.openrouter.map((model) => model.id)
    const preferredProvider = profile.default_provider ?? DEFAULT_CHAT_PROVIDER
    const defaultProvider = resolveDefaultProvider(preferredProvider, hasAnthropicKey)
    const defaultModel = resolveDefaultModel(defaultProvider, profile.default_model, hasAnthropicKey, openRouterModelIds)

    return NextResponse.json({
      providers: catalog.providers,
      modelsByProvider: catalog.modelsByProvider,
      defaults: {
        provider: defaultProvider,
        model: defaultModel,
      },
      account: {
        isGuest: profile.is_guest,
        hasAnthropicKey,
      },
    })
  } catch (error) {
    console.error('Failed to load chat provider catalog', error)
    return NextResponse.json(
      { error: 'provider_catalog_unavailable', message: 'We could not load model availability right now.' },
      { status: 500 },
    )
  }
}
