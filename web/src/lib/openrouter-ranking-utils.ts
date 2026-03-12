const OPENROUTER_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*(?::[a-z0-9][a-z0-9._-]*)?$/i

function isValidOpenRouterModelId(value: string): boolean {
  return OPENROUTER_MODEL_ID_PATTERN.test(value)
}

export function extractRankingModelIdsFromPayload(payload: string): string[] {
  if (!payload) return []

  const primaryPattern = /"variant_permaslug":"([^"]+)"/g

  const seen = new Set<string>()
  const models: string[] = []

  const stripDateSuffix = (value: string): string =>
    value
      .replace(/-\d{8}$/i, '')
      .replace(/-\d{4}-\d{2}-\d{2}$/i, '')
      .replace(/-\d{2}-\d{2}$/i, '')

  const collectMatches = (pattern: RegExp): void => {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(payload)) !== null) {
      const rawId = match[1]?.trim().toLowerCase()
      if (!rawId || !isValidOpenRouterModelId(rawId)) continue
      
      const id = stripDateSuffix(rawId)
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
      seen.add(id)
      models.push(id)
    }
  }

  // Prefer variant_permaslug because it is model-specific and avoids nav/site route noise.
  collectMatches(primaryPattern)
  if (models.length > 0) {
    return models
  }

  const fallbackPatterns = [
    /href="\/([^"]+)"/g,
    /\b([a-z0-9-]+\/[a-z0-9._-]+(?::[a-z0-9._-]+)?)\b/gi,
  ]

  for (const pattern of fallbackPatterns) {
    collectMatches(pattern)
  }

  return models
}

export function extractFreeModelIdsFromRankingPayload(payload: string): string[] {
  return extractRankingModelIdsFromPayload(payload).filter((id) => id.endsWith(':free'))
}

export function mergeRankingModelOrders(orders: ReadonlyArray<ReadonlyArray<string>>): string[] {
  const scoreById = new Map<string, { count: number; totalRank: number; bestRank: number }>()

  for (const order of orders) {
    for (let index = 0; index < order.length; index += 1) {
      const rawId = order[index]
      const id = rawId.trim().toLowerCase()
      if (!id) continue

      const rank = index + 1
      const existing = scoreById.get(id)
      if (!existing) {
        scoreById.set(id, { count: 1, totalRank: rank, bestRank: rank })
        continue
      }

      existing.count += 1
      existing.totalRank += rank
      if (rank < existing.bestRank) existing.bestRank = rank
    }
  }

  return [...scoreById.entries()]
    .sort((a, b) => {
      const [, scoreA] = a
      const [, scoreB] = b

      if (scoreA.count !== scoreB.count) return scoreB.count - scoreA.count

      const averageA = scoreA.totalRank / scoreA.count
      const averageB = scoreB.totalRank / scoreB.count
      if (averageA !== averageB) return averageA - averageB

      if (scoreA.bestRank !== scoreB.bestRank) return scoreA.bestRank - scoreB.bestRank
      return a[0].localeCompare(b[0])
    })
    .map(([id]) => id)
}
