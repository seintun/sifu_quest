export type SanitizedChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function sanitizeIncomingChatMessages(messages: unknown): SanitizedChatMessage[] {
  if (!Array.isArray(messages)) {
    return []
  }

  const sanitized: SanitizedChatMessage[] = []
  for (const raw of messages) {
    if (!raw || typeof raw !== 'object') {
      continue
    }

    const typed = raw as { role?: unknown; content?: unknown }
    if (typeof typed.role !== 'string' || typeof typed.content !== 'string') {
      continue
    }

    const normalizedRole = typed.role.trim().toLowerCase()
    if (normalizedRole !== 'user' && normalizedRole !== 'assistant') {
      continue
    }

    const normalizedContent = typed.content.trim()
    if (normalizedContent.length === 0) {
      continue
    }

    sanitized.push({
      role: normalizedRole,
      content: normalizedContent,
    })
  }

  return sanitized
}
