export type LinkedProfileUpdate = {
  is_guest: false
  guest_expires_at: null
  last_active_at: string
  display_name?: string
  avatar_url?: string
}

export function buildLinkedProfileUpdate(userMetadata: Record<string, unknown> | null | undefined, nowIso: string = new Date().toISOString()): LinkedProfileUpdate {
  const metadata = userMetadata ?? {}

  const displayName =
    typeof metadata.name === 'string' && metadata.name.trim().length > 0
      ? metadata.name.trim()
      : null

  const avatarUrl =
    typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim().length > 0
      ? metadata.avatar_url.trim()
      : null

  const updatePayload: LinkedProfileUpdate = {
    is_guest: false,
    guest_expires_at: null,
    last_active_at: nowIso,
  }

  if (displayName) {
    updatePayload.display_name = displayName
  }
  if (avatarUrl) {
    updatePayload.avatar_url = avatarUrl
  }

  return updatePayload
}
