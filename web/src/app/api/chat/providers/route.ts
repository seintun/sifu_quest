import { auth } from '@/auth'
import { decryptKey } from '@/lib/apikey'
import { ensureUserProfile } from '@/lib/account-state'
import { DEFAULT_CHAT_PROVIDER, type ChatProvider } from '@/lib/chat-provider-config'
import { loadChatEntitlements } from '@/lib/chat-entitlements'
import { resolveProviderSelection } from '@/lib/chat-selection'
import { buildProviderCatalog } from '@/lib/provider-catalog'
import { getEncryptedProviderApiKey } from '@/lib/provider-api-keys'
import { resolveCanonicalUserId } from '@/lib/user-identity'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function parseBooleanFlag(value: string | null): boolean {
  return value === '1' || value === 'true'
}

function resolveDefaultProvider(preferredProvider: ChatProvider, hasAnthropicKey: boolean): ChatProvider {
  if (preferredProvider === 'anthropic' && !hasAnthropicKey) {
    return DEFAULT_CHAT_PROVIDER
  }
  return preferredProvider
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await resolveCanonicalUserId(session.user.id, session.user.email)
    const profile = await ensureUserProfile(userId, session.user.email)
    const entitlements = await loadChatEntitlements(userId)
    const encryptedOpenRouterKey = entitlements.providerKeys.openrouter
      ? await getEncryptedProviderApiKey(userId, 'openrouter')
      : null
    const openRouterApiKey = encryptedOpenRouterKey ? decryptKey(encryptedOpenRouterKey) : null

    const { searchParams } = new URL(request.url)
    const includeAllOpenRouterModels = parseBooleanFlag(searchParams.get('openrouterAll'))
    const openRouterQuery = searchParams.get('openrouterQuery')
    const catalog = await buildProviderCatalog({
      providerKeys: entitlements.providerKeys,
      openRouterModelScope: entitlements.openRouterModelScope,
      includeAllOpenRouterModels,
      openRouterQuery,
      userCacheKey: userId,
      openRouterApiKey,
    })

    const preferredProvider = profile.default_provider ?? DEFAULT_CHAT_PROVIDER
    const defaultProvider = resolveDefaultProvider(preferredProvider, entitlements.providerKeys.anthropic)
    const defaultSelection = await resolveProviderSelection({
      preferredProvider: defaultProvider,
      preferredModel: profile.default_model,
      providerKeys: entitlements.providerKeys,
      openRouterModelScope: entitlements.openRouterModelScope,
      userCacheKey: userId,
      openRouterApiKey,
    })
    const defaultModel = defaultSelection.ok
      ? defaultSelection.selection.model
      : (catalog.modelsByProvider.openrouter[0]?.id ?? catalog.defaults.model)

    return NextResponse.json({
      providers: catalog.providers,
      modelsByProvider: catalog.modelsByProvider,
      modelGroupsByProvider: catalog.modelGroupsByProvider,
      defaults: {
        provider: defaultProvider,
        model: defaultModel,
      },
      account: {
        isGuest: profile.is_guest,
        hasProviderKey: entitlements.providerKeys,
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
