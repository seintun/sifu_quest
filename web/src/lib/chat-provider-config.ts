export type ChatProvider = "openrouter" | "anthropic";
export type AnthropicModelCostTier = 1 | 2 | 3;
export type OpenRouterModelScope = "free_only" | "full_catalog";

export type ModelAvailability =
  | "available"
  | "requires_key"
  | "temporarily_unavailable";

export type ChatModelDescriptor = {
  id: string;
  label: string;
  modelId: string; // Slug-friendly ID for UI elements (e.g., "gpt-oss-120b-free")
  provider: ChatProvider;
  isFree: boolean;
  availability: ModelAvailability;
  recommendationRank?: number;
  reason?: string;
};

export type ChatModelGroupDescriptor = {
  id: string;
  label: string;
  models: ChatModelDescriptor[];
  hasMore?: boolean;
};

export type ChatProviderDescriptor = {
  id: ChatProvider;
  label: string;
  availability: ModelAvailability;
  reason?: string;
};

export type ProviderModelTips = {
  primaryText?: string;
  sourceLabel: string;
  sourceUrl: string;
  secondaryText?: string;
  pricingLabel?: string;
  pricingUrl?: string;
};

export type ProviderKeyMap = {
  openrouter: boolean;
  anthropic: boolean;
};

export const DEFAULT_CHAT_PROVIDER: ChatProvider = "openrouter";
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-oss-20b:free";
export const OPENROUTER_FREE_ROUTER_MODEL = "openrouter/free";

export const OPENROUTER_STATIC_FREE_MODEL_FALLBACKS = [
  DEFAULT_OPENROUTER_MODEL,
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "stepfun/step-3.5-flash:free",
  "qwen/qwen3-coder:free",
] as const;

export const OPENROUTER_ALL_MODELS_INITIAL_LIMIT = 80;
export const OPENROUTER_RECOMMENDED_MODELS_LIMIT = 20;
export const OPENROUTER_RANKING_TOP_MODELS_LIMIT = 10;

export const ANTHROPIC_MODEL_CATALOG: ReadonlyArray<{
  id: string;
  label: string;
  costTier: AnthropicModelCostTier;
}> = [
  { id: "claude-haiku-4-5", label: "Claude Haiku", costTier: 1 },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet", costTier: 2 },
  { id: "claude-opus-4-6", label: "Claude Opus", costTier: 3 },
] as const;

export const PROVIDER_MODEL_TIPS: Record<ChatProvider, ProviderModelTips> = {
  openrouter: {
    primaryText: "Ranking: lower # is better (#1 best).",
    sourceLabel: "openrouter.ai/rankings",
    sourceUrl: "https://openrouter.ai/rankings?category=programming#categories",
    secondaryText: "Icon + # for accessibility.",
    pricingLabel: "openrouter.ai/pricing",
    pricingUrl: "https://openrouter.ai/pricing",
  },
  anthropic: {
    sourceLabel: "platform.claude.com pricing",
    sourceUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
  },
} as const;

export function isChatProvider(value: unknown): value is ChatProvider {
  return value === "openrouter" || value === "anthropic";
}

export function parseChatProvider(
  value: unknown,
  fallback: ChatProvider = DEFAULT_CHAT_PROVIDER,
): ChatProvider {
  return isChatProvider(value) ? value : fallback;
}

export function isOpenRouterFreeModel(modelId: string): boolean {
  const normalized = modelId.trim().toLowerCase();
  if (normalized === OPENROUTER_FREE_ROUTER_MODEL) return true;
  return /.+[^:]:free$/i.test(normalized);
}

export function isKnownAnthropicModel(modelId: string): boolean {
  return ANTHROPIC_MODEL_CATALOG.some((model) => model.id === modelId);
}

export function getAnthropicDefaultModel(): string {
  return ANTHROPIC_MODEL_CATALOG[0].id;
}

export function getAnthropicModelCostTier(
  modelId: string,
): AnthropicModelCostTier | null {
  return (
    ANTHROPIC_MODEL_CATALOG.find((model) => model.id === modelId)?.costTier ??
    null
  );
}

export function getProviderLabel(provider: ChatProvider): string {
  if (provider === "anthropic") {
    return "Anthropic";
  }
  return "OpenRouter";
}

export function getProviderModelTips(provider: ChatProvider): ProviderModelTips {
  return PROVIDER_MODEL_TIPS[provider];
}

export function sanitizeModelLabel(modelId: string): string {
  const stripped = modelId.replace(/:free$/i, " (free)").replace(/[-_]/g, " ");
  return stripped
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ");
}

// =============================================================================
// Shared Utilities for OpenRouter Model Processing
// =============================================================================

const DATE_SUFFIX_PATTERN = /-\d{8}$/i
const DATE_SUFFIX_PATTERN_LONG = /-\d{4}-\d{2}-\d{2}$/i
const DATE_SUFFIX_PATTERN_SHORT = /-\d{2}-\d{2}$/i

/**
 * Strip date suffixes from model IDs for consistent matching.
 * e.g., "minimax-m2.5-20260211" -> "minimax-m2.5"
 * e.g., "model-2026-02-11" -> "model"
 */
export function stripModelDateSuffix(modelId: string): string {
  return modelId
    .replace(DATE_SUFFIX_PATTERN, '')
    .replace(DATE_SUFFIX_PATTERN_LONG, '')
    .replace(DATE_SUFFIX_PATTERN_SHORT, '')
}

/**
 * Generate all possible lookup keys for matching a model ID against ranking data.
 * Handles :free suffixes and date suffixes.
 */
export function getRankingLookupKeys(modelId: string): string[] {
  const normalized = modelId.trim().toLowerCase()
  if (!normalized) return []

  const withoutFree = normalized.endsWith(':free')
    ? normalized.slice(0, -5) // remove :free
    : normalized

  const dateStripped = stripModelDateSuffix(withoutFree)

  // Generate unique keys
  const keys = new Set<string>([
    normalized,
    withoutFree,
    dateStripped,
    `${normalized}:free`,
    `${withoutFree}:free`,
    `${dateStripped}:free`,
  ])

  // Clean up any empty strings and return
  return [...keys].filter(Boolean)
}

/**
 * Resolve a model's rank from a ranking map using all possible lookup keys.
 * Returns null if no rank found.
 */
export function resolveModelRank(rankById: Map<string, number>, modelId: string): number | null {
  for (const key of getRankingLookupKeys(modelId)) {
    const rank = rankById.get(key)
    if (rank) return rank
  }
  return null
}

// Generate a slug-friendly modelId for UI elements (e.g., "openai/gpt-oss-120b:free" -> "openai-gpt-oss-120b-free")
export function generateModelId(modelId: string): string {
  return modelId.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
