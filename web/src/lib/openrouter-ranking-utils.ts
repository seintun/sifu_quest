export function extractRankingModelIdsFromPayload(payload: string): string[] {
  if (!payload) return []

  const patterns = [
    /"variant_permaslug":"([^"]+)"/g,
    /href="\/([^"]+)"/g,
    /\b([a-z0-9-]+\/[a-z0-9._-]+(?::[a-z0-9._-]+)?)\b/gi,
  ]

  const seen = new Set<string>()
  const models: string[] = []

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(payload)) !== null) {
      const id = match[1]?.trim().toLowerCase()
      if (!id || seen.has(id)) continue
      seen.add(id)
      models.push(id)
    }
  }

  return models
}

export function extractFreeModelIdsFromRankingPayload(payload: string): string[] {
  return extractRankingModelIdsFromPayload(payload).filter((id) => id.endsWith(':free'))
}
