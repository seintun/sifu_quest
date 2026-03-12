import type { UserProfileState } from './account-state'
import type { ProviderKeyMap, ChatProvider, OpenRouterModelScope } from './chat-provider-config'
import { hasEncryptedProviderApiKey } from './provider-api-keys'

export type ChatEntitlements = {
  providerKeys: ProviderKeyMap
  hasAnyProviderKey: boolean
  openRouterModelScope: OpenRouterModelScope
}

export async function loadProviderKeyMap(userId: string): Promise<ProviderKeyMap> {
  const [openrouter, anthropic] = await Promise.all([
    hasEncryptedProviderApiKey(userId, 'openrouter'),
    hasEncryptedProviderApiKey(userId, 'anthropic'),
  ])

  return { openrouter, anthropic }
}

export function deriveChatEntitlements(providerKeys: ProviderKeyMap): ChatEntitlements {
  const hasAnyProviderKey = providerKeys.openrouter || providerKeys.anthropic
  return {
    providerKeys,
    hasAnyProviderKey,
    openRouterModelScope: providerKeys.openrouter ? 'full_catalog' : 'free_only',
  }
}

export async function loadChatEntitlements(userId: string): Promise<ChatEntitlements> {
  const providerKeys = await loadProviderKeyMap(userId)
  return deriveChatEntitlements(providerKeys)
}

export function shouldEnforceQuotaForProvider(
  profile: Pick<UserProfileState, 'is_guest'>,
  provider: ChatProvider,
  entitlements: ChatEntitlements,
): boolean {
  if (profile.is_guest) {
    return true
  }

  if (!entitlements.hasAnyProviderKey) {
    return true
  }

  return !entitlements.providerKeys[provider]
}
