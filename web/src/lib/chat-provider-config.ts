export type ChatProvider = "openrouter" | "anthropic";
export type AnthropicModelCostTier = 1 | 2 | 3;

export type ModelAvailability =
  | "available"
  | "requires_key"
  | "temporarily_unavailable";

export type ChatModelDescriptor = {
  id: string;
  label: string;
  provider: ChatProvider;
  isFree: boolean;
  availability: ModelAvailability;
  recommendationRank?: number;
  reason?: string;
};

export type ChatProviderDescriptor = {
  id: ChatProvider;
  label: string;
  availability: ModelAvailability;
  reason?: string;
};

export const DEFAULT_CHAT_PROVIDER: ChatProvider = "openrouter";
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-oss-20b:free";
export const OPENROUTER_FREE_ROUTER_MODEL = "openrouter/free";

export const OPENROUTER_STATIC_FREE_MODEL_FALLBACKS = [
  DEFAULT_OPENROUTER_MODEL,
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
] as const;

export const ANTHROPIC_MODEL_CATALOG: ReadonlyArray<{
  id: string;
  label: string;
  costTier: AnthropicModelCostTier;
}> = [
  { id: "claude-haiku-4-5", label: "Claude Haiku", costTier: 1 },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet", costTier: 2 },
  { id: "claude-opus-4-6", label: "Claude Opus", costTier: 3 },
] as const;

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
  return modelId === OPENROUTER_FREE_ROUTER_MODEL || modelId.endsWith(":free");
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

export function sanitizeModelLabel(modelId: string): string {
  const stripped = modelId.replace(/:free$/i, " (free)").replace(/[-_]/g, " ");
  return stripped
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ");
}
