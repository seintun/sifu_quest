import {
  generateModelId,
  isOpenRouterFreeModel,
  resolveModelRank,
  sanitizeModelLabel,
  type ChatModelDescriptor,
} from './chat-provider-config.ts'

export type OpenRouterModelRecord = {
  id?: string
  created?: number | string | null
}

function parseOpenRouterCreatedTimestamp(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    const numeric = Number(trimmed)
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric
    }
  }

  return null
}

export function normalizeOpenRouterModelRecords(records: OpenRouterModelRecord[]): ChatModelDescriptor[] {
  const byId = new Map<string, { id: string; created: number | null }>()

  for (const record of records) {
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (!id) continue

    const key = id.toLowerCase()
    const created = parseOpenRouterCreatedTimestamp(record.created)
    const existing = byId.get(key)
    if (!existing || (created ?? -1) > (existing.created ?? -1)) {
      byId.set(key, { id, created })
    }
  }

  return [...byId.values()]
    .sort((a, b) => {
      const createdA = a.created ?? Number.MIN_SAFE_INTEGER
      const createdB = b.created ?? Number.MIN_SAFE_INTEGER
      if (createdA !== createdB) return createdB - createdA
      return a.id.localeCompare(b.id)
    })
    .map<ChatModelDescriptor>(({ id }) => ({
      id,
      label: sanitizeModelLabel(id),
      modelId: generateModelId(id),
      provider: 'openrouter',
      isFree: isOpenRouterFreeModel(id),
      availability: 'available',
    }))
}

export function sortAndAnnotateOpenRouterModelsByRanking(
  models: ChatModelDescriptor[],
  dynamicOrder: readonly string[] = [],
): ChatModelDescriptor[] {
  if (dynamicOrder.length === 0) {
    return [...models]
  }

  const rankById = new Map<string, number>(dynamicOrder.map((id, index) => [id.toLowerCase(), index + 1]))

  return models
    .map((model) => {
      const rank = resolveModelRank(rankById, model.id)
      return rank ? { ...model, recommendationRank: rank } : model
    })
    .sort((a, b) => {
      const rankA = a.recommendationRank ?? Number.MAX_SAFE_INTEGER
      const rankB = b.recommendationRank ?? Number.MAX_SAFE_INTEGER
      if (rankA !== rankB) return rankA - rankB
      return a.id.localeCompare(b.id)
    })
}

export function buildRecommendedOpenRouterModels(
  models: ChatModelDescriptor[],
  dynamicOrder: readonly string[],
  limit: number,
): ChatModelDescriptor[] {
  if (models.length === 0 || limit <= 0) return []

  // If no ranking data, return first N models sorted by recency
  if (dynamicOrder.length === 0) {
    return models.slice(0, Math.min(models.length, limit))
  }

  // Build rank map from order
  const rankById = new Map<string, number>(dynamicOrder.map((id, index) => [id.toLowerCase(), index + 1]))

  // Filter models that appear in rankings and add their rank
  const ranked: ChatModelDescriptor[] = []
  for (const model of models) {
    const rank = resolveModelRank(rankById, model.id)
    if (rank) {
      ranked.push({ ...model, recommendationRank: rank })
    }
  }

  // Sort by rank
  if (ranked.length > 0) {
    ranked.sort((a, b) => {
      const rankA = a.recommendationRank ?? Number.MAX_SAFE_INTEGER
      const rankB = b.recommendationRank ?? Number.MAX_SAFE_INTEGER
      if (rankA !== rankB) return rankA - rankB
      return a.id.localeCompare(b.id)
    })
    return ranked.slice(0, limit)
  }

  // Fallback: return newest models
  return models.slice(0, Math.min(models.length, limit))
}
