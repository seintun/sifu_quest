export type ChatSystemCode =
  | 'free_tier_exhausted'
  | 'guest_limit_reached'
  | 'provider_key_required'
  | 'invalid_provider_key'
  | 'chat_temporary_error'

export type ChatMessageMeta = {
  kind: 'system'
  code: ChatSystemCode
}

const SYSTEM_MESSAGES: Record<ChatSystemCode, string> = {
  free_tier_exhausted:
    'You have exhausted your free messages. To continue your mastery journey, go to **Settings** and add your own Anthropic API key. Your key is encrypted with AES-256-CBC before storage, and your past conversation remains accessible here.',
  guest_limit_reached:
    'You have reached the guest limit. Please sign up to continue. After creating your account, add your own Anthropic API key in **Settings** to keep chatting securely.',
  provider_key_required:
    'Anthropic models require your own Anthropic API key. Add your key in **Settings** and try again.',
  invalid_provider_key:
    'Your saved Anthropic API key could not be used. Re-add your key in **Settings** and try again.',
  chat_temporary_error:
    'I hit a temporary issue loading your workspace. Please try again in a moment.',
}

export function getSystemMessage(code: ChatSystemCode): string {
  return SYSTEM_MESSAGES[code]
}

export function buildSystemMeta(code: ChatSystemCode): ChatMessageMeta {
  return { kind: 'system', code }
}

export function isSystemMeta(value: unknown): value is ChatMessageMeta {
  if (!value || typeof value !== 'object') return false
  const typed = value as Partial<ChatMessageMeta>
  return typed.kind === 'system' && typeof typed.code === 'string' && typed.code in SYSTEM_MESSAGES
}
