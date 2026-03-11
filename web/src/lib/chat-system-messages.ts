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
    'Free limit reached. Visit **Settings** to add your Anthropic BYOK for unlimited AI chat usage.',
  guest_limit_reached:
    'Guest limit reached. Sign up, then add Anthropic BYOK in **Settings** to continue.',
  provider_key_required:
    'Anthropic requires BYOK. Add your key in **Settings** to continue.',
  invalid_provider_key:
    'Your saved Anthropic key is invalid. Re-add it in **Settings** and try again.',
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
