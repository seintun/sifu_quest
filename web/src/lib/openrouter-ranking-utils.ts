import { stripModelDateSuffix } from './chat-provider-config.ts'

const OPENROUTER_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*(?::[a-z0-9][a-z0-9._-]*)?$/i

function isValidOpenRouterModelId(value: string): boolean {
  return OPENROUTER_MODEL_ID_PATTERN.test(value)
}

export function extractRankingModelIdsFromPayload(payload: string): string[] {
  if (!payload) return []

  const primaryPattern = /"variant_permaslug":"([^"]+)"/g
  const seen = new Set<string>()
  const models: string[] = []

  const collectMatches = (pattern: RegExp, stripDate: boolean): void => {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(payload)) !== null) {
      const rawId = match[1]?.trim().toLowerCase()
      if (!rawId || !isValidOpenRouterModelId(rawId)) continue

      // Strip date suffix for matching/lookup, but preserve original in output
      const id = stripDate ? stripModelDateSuffix(rawId) : rawId
      if (seen.has(id)) continue

      const matchedText = match[0] ?? ''
      const relativeStart = matchedText.indexOf(match[1] ?? '')
      const absoluteEnd = relativeStart >= 0
        ? match.index + relativeStart + (match[1]?.length ?? 0)
        : pattern.lastIndex
      const trailingChar = payload[absoluteEnd]
      if (trailingChar === '?' || trailingChar === '#') {
        continue
      }

      // For primary pattern (variant_permaslug), preserve the original ID
      const outputId = pattern === primaryPattern ? rawId : id
      seen.add(id)
      models.push(outputId)
    }
  }

  // Prefer variant_permaslug because it's model-specific and avoids nav/site route noise
  collectMatches(primaryPattern, false)
  if (models.length > 0) {
    return models
  }

  // Fallback to other patterns (strip dates for matching)
  const fallbackPatterns = [
    /href="\/([^"]+)"/g,
    /\b([a-z0-9-]+\/[a-z0-9._-]+(?::[a-z0-9._-]+)?)\b/gi,
  ]

  for (const pattern of fallbackPatterns) {
    collectMatches(pattern, true)
  }

  return models
}

export function extractFreeModelIdsFromRankingPayload(payload: string): string[] {
  return extractRankingModelIdsFromPayload(payload).filter((id) => id.endsWith(':free'))
}