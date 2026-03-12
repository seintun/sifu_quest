"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ChatModelGroupOption,
  ChatModelOption,
  ChatProviderOption,
} from "@/hooks/useChat";
import {
  getAnthropicModelCostTier,
  getProviderModelTips,
} from "@/lib/chat-provider-config";
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Coins,
  Lightbulb,
  LockKeyhole,
  Medal,
  MessageSquare,
  Network,
  Settings2,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

export type ModeOption = {
  value: string;
  label: string;
};

type SharedControlProps = {
  providers: ChatProviderOption[];
  selectedProvider: "openrouter" | "anthropic";
  onProviderChange: (value: "openrouter" | "anthropic") => void;
  models: ChatModelOption[];
  modelGroups?: ChatModelGroupOption[];
  selectedModel: string;
  onModelChange: (value: string) => void;
  onLoadAllOpenRouterModels?: () => void;
  isLoadingOpenRouterAllModels?: boolean;
  modes: ModeOption[];
  selectedMode: string;
  onModeChange: (value: string) => void;
  onClear: () => void;
  byokNotice?: string | null;
  isOpenRouterLocked?: boolean;
};

const MODEL_SELECT_CONTENT_CLASS =
  "w-[min(24rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-x-auto";
const MODEL_SELECT_CONTENT_MOBILE_CLASS =
  "w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-x-auto";
const MODEL_SELECT_CONTENT_COMPACT_CLASS =
  "w-[min(18rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-x-auto";
const MODEL_SELECT_CONTENT_MOBILE_COMPACT_CLASS =
  "w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-auto";
const MODEL_TRIGGER_CLASS =
  "[&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:max-w-full [&_[data-slot=select-value]]:overflow-hidden [&_[data-slot=select-value]]:items-center";
const PROVIDER_TRIGGER_CLASS =
  "[&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:items-center";
const PROVIDER_SELECT_CONTENT_CLASS = "min-w-[16rem]";
const CLEAR_CHAT_TOOLTIP_TEXT = "Clears all messages in this chat session.";

function formatProviderLabel(
  provider: Pick<ChatProviderOption, "id" | "label">,
): string {
  if (provider.id === "openrouter") return "OpenRouter";
  if (provider.id === "anthropic") return "Anthropic";
  return provider.label;
}

function CostTierIcons({ tier }: { tier: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-1 text-warning">
      <Coins className="h-3 w-3" />
      <span className="text-[11px] leading-none font-medium">x{tier}</span>
    </span>
  );
}

function RecommendationBadge({ rank }: { rank?: number }) {
  if (!rank) return null;
  const Icon = rank === 1 ? Trophy : rank <= 3 ? Medal : Sparkles;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary">
      <Icon className="h-2.5 w-2.5" />
      <span>#{rank}</span>
    </span>
  );
}

function RecommendationBadgeSlot({ rank }: { rank?: number }) {
  return (
    <span className="inline-flex min-h-6 w-[3.35rem] items-center justify-start">
      {rank ? <RecommendationBadge rank={rank} /> : null}
    </span>
  );
}

function FreeModelBadge({ isFree }: { isFree?: boolean }) {
  if (!isFree) return null;
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-emerald-200">
      Free
    </span>
  );
}

function ModelProviderTips({
  provider,
}: {
  provider: "openrouter" | "anthropic";
}) {
  const tips = getProviderModelTips(provider);

  return (
    <>
      <SelectGroup>
        {tips.primaryText ? (
          <SelectLabel className="text-[11px] leading-tight text-muted-foreground">
            {tips.primaryText}
            {tips.secondaryText ? <> {tips.secondaryText}</> : null}
          </SelectLabel>
        ) : null}
        <SelectLabel className="pt-0 text-[11px] leading-tight text-muted-foreground">
          Source:{" "}
          <a
            href={tips.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {tips.sourceLabel}
          </a>
          {tips.pricingLabel && tips.pricingUrl ? (
            <>
              {" "}
              • Pricing:{" "}
              <a
                href={tips.pricingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                {tips.pricingLabel}
              </a>
            </>
          ) : null}
        </SelectLabel>
      </SelectGroup>
      <SelectSeparator />
    </>
  );
}

function ModelOptionContent({
  label,
  recommendationRank,
  tier,
  isFree,
  showRanking = true,
  reserveRankingSlot = true,
}: {
  label: string;
  recommendationRank?: number;
  tier?: 1 | 2 | 3 | null;
  isFree?: boolean;
  showRanking?: boolean;
  reserveRankingSlot?: boolean;
}) {
  const normalizedLabel = isFree
    ? label.replace(/\s*\(free\)\s*$/i, "")
    : label;

  if (!showRanking) {
    return (
      <span className="inline-flex w-full min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate whitespace-nowrap leading-tight">
          {normalizedLabel}
        </span>
        <FreeModelBadge isFree={isFree} />
        {tier ? <CostTierIcons tier={tier} /> : null}
      </span>
    );
  }

  if (!reserveRankingSlot) {
    return (
      <span className="inline-flex w-full min-w-0 items-center gap-2">
        {recommendationRank ? (
          <span className="shrink-0">
            <RecommendationBadge rank={recommendationRank} />
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate whitespace-nowrap leading-tight">
          {normalizedLabel}
        </span>
        <span className="shrink-0">
          <FreeModelBadge isFree={isFree} />
        </span>
        <span className="shrink-0">{tier ? <CostTierIcons tier={tier} /> : null}</span>
      </span>
    );
  }

  return (
    <span className="grid w-full grid-cols-[3.35rem_minmax(0,1fr)_auto_auto] items-center gap-2">
      <RecommendationBadgeSlot rank={recommendationRank} />
      <span className="min-w-0 truncate whitespace-nowrap leading-tight">
        {normalizedLabel}
      </span>
      <FreeModelBadge isFree={isFree} />
      {tier ? <CostTierIcons tier={tier} /> : <span />}
    </span>
  );
}

function ProviderOptionLabel({
  provider,
  openRouterLocked = false,
}: {
  provider: ChatProviderOption;
  openRouterLocked?: boolean;
}) {
  const label = formatProviderLabel(provider);

  if (
    provider.id === "openrouter" &&
    provider.availability === "available" &&
    openRouterLocked
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 leading-none whitespace-nowrap">
        <span>{label}</span>
        <span className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
          Free models only
        </span>
      </span>
    );
  }

  if (provider.availability === "available") {
    return <span>{label}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5 leading-none">
      <LockKeyhole className="h-3.5 w-3.5 text-warning" />
      <span>{label} (key required)</span>
    </span>
  );
}

function ModeOptionContent({ mode }: { mode: ModeOption }) {
  const source = `${mode.value.toLowerCase()} ${mode.label.toLowerCase()}`;
  const { Icon, colorClassName } = source.includes("system")
    ? { Icon: Network, colorClassName: "text-design" }
    : source.includes("interview")
      ? { Icon: MessageSquare, colorClassName: "text-primary" }
      : source.includes("job")
        ? { Icon: Briefcase, colorClassName: "text-jobs" }
        : source.includes("business")
          ? { Icon: Lightbulb, colorClassName: "text-warning" }
          : { Icon: Medal, colorClassName: "text-dsa" };

  return (
    <span className="inline-flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 ${colorClassName}`} />
      <span>{mode.label}</span>
    </span>
  );
}

function stopSelectTypeaheadEvent(
  event: React.KeyboardEvent<HTMLInputElement>,
) {
  event.stopPropagation();
}

function OpenRouterLockedCatalogNotice() {
  return (
    <div className="px-2 py-2">
      <div className="rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
        <div className="inline-flex items-center gap-1.5 font-medium">
          <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
          <span>All OpenRouter models are locked</span>
        </div>
        <p className="mt-1 leading-relaxed text-warning/90">
          Add your OpenRouter API key to unlock this section and browse the full
          catalog.
        </p>
        <Link
          href="/settings"
          className="mt-1.5 inline-flex items-center gap-1 underline underline-offset-2 hover:text-warning/90"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Go to Settings
        </Link>
      </div>
    </div>
  );
}

function isGroupExpandedByDefault(
  provider: "openrouter" | "anthropic",
  groupId: string,
): boolean {
  if (provider === "openrouter") {
    return groupId === "recommended";
  }
  return true;
}

function ControlsBody({
  providers,
  selectedProvider,
  onProviderChange,
  models,
  selectedModel,
  onModelChange,
  modelGroups,
  onLoadAllOpenRouterModels,
  isLoadingOpenRouterAllModels,
  modes,
  selectedMode,
  onModeChange,
  onClear,
  byokNotice,
  isOpenRouterLocked,
}: SharedControlProps) {
  const selectedProviderOption = useMemo(
    () => providers.find((provider) => provider.id === selectedProvider),
    [providers, selectedProvider],
  );
  const selectedModelOption = useMemo(
    () => models.find((model) => model.id === selectedModel),
    [models, selectedModel],
  );
  const selectedModeOption = useMemo(
    () => modes.find((mode) => mode.value === selectedMode),
    [modes, selectedMode],
  );
  const showOpenRouterRanking = selectedProvider === "openrouter";
  const [modelSearch, setModelSearch] = useState("");
  const [expandedModelGroups, setExpandedModelGroups] = useState<
    Record<string, boolean>
  >({});
  const filteredModelGroups = useMemo(() => {
    const groups =
      modelGroups && modelGroups.length > 0
        ? modelGroups
        : [{ id: "all", label: "Models", models, hasMore: false }];
    if (groups.length === 0) {
      return [] as Array<ChatModelGroupOption & { hasMore?: boolean }>;
    }
    const query = modelSearch.trim().toLowerCase();
    if (!query) {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        models: group.models.filter(
          (model) =>
            model.id.toLowerCase().includes(query) ||
            model.label.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.models.length > 0);
  }, [modelGroups, modelSearch, models]);
  const selectedTier =
    selectedModelOption?.provider === "anthropic"
      ? getAnthropicModelCostTier(selectedModelOption.id)
      : null;
  const hasModelSearch = modelSearch.trim().length > 0;

  return (
    <div className="grid gap-3">
      {byokNotice && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-[11px] text-warning flex items-center justify-between gap-2">
          <span className="truncate">{byokNotice}</span>
          <Link
            href="/settings"
            className="underline underline-offset-2 whitespace-nowrap hover:text-warning/90 shrink-0"
          >
            Settings
          </Link>
        </div>
      )}

      <label className="grid gap-1 text-xs text-muted-foreground">
        Provider
        <Select
          value={selectedProvider}
          onValueChange={(value) =>
            onProviderChange(value as "openrouter" | "anthropic")
          }
        >
          <SelectTrigger
            data-testid="mobile-provider-select"
            className={`w-full bg-surface border-border h-10 ${PROVIDER_TRIGGER_CLASS}`}
          >
            <SelectValue>
              {selectedProviderOption ? (
                <ProviderOptionLabel
                  provider={selectedProviderOption}
                  openRouterLocked={Boolean(isOpenRouterLocked)}
                />
              ) : (
                "Provider"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            align="start"
            sideOffset={2}
            className={PROVIDER_SELECT_CONTENT_CLASS}
          >
            {providers.map((provider) => (
              <SelectItem
                key={provider.id}
                value={provider.id}
                data-testid={`provider-option-${provider.id}`}
                disabled={provider.availability !== "available"}
              >
                <ProviderOptionLabel
                  provider={provider}
                  openRouterLocked={Boolean(isOpenRouterLocked)}
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Model
        <Select
          value={selectedModel}
          onValueChange={(value) => value && onModelChange(value)}
        >
          <SelectTrigger
            className={`w-full bg-surface border-border h-10 ${MODEL_TRIGGER_CLASS}`}
          >
            <SelectValue>
              {selectedModelOption ? (
                <ModelOptionContent
                  label={selectedModelOption.label}
                  recommendationRank={
                    showOpenRouterRanking
                      ? selectedModelOption.recommendationRank
                      : undefined
                  }
                  tier={selectedTier}
                  isFree={
                    selectedProvider === "openrouter"
                      ? selectedModelOption.isFree
                      : false
                  }
                  showRanking={showOpenRouterRanking}
                  reserveRankingSlot={false}
                />
              ) : (
                "Model"
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            align="end"
            className={
              showOpenRouterRanking
                ? MODEL_SELECT_CONTENT_MOBILE_CLASS
                : MODEL_SELECT_CONTENT_MOBILE_COMPACT_CLASS
            }
          >
            <div className="sticky top-0 z-10 bg-popover">
              <ModelProviderTips provider={selectedProvider} />
              {selectedProvider === "openrouter" && (
                <div className="px-2 pb-2">
                  <Input
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                    onKeyDown={stopSelectTypeaheadEvent}
                    onKeyUp={stopSelectTypeaheadEvent}
                    placeholder="Search OpenRouter models"
                    aria-label="Search OpenRouter models"
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>
            <div className="max-h-[min(72vh,42rem)] overflow-y-auto overscroll-contain px-1 pb-1">
              {filteredModelGroups.map((group) => {
                const isExpanded =
                  hasModelSearch ||
                  (expandedModelGroups[group.id] ??
                    isGroupExpandedByDefault(selectedProvider, group.id));
                const isAllModelsLockedGroup =
                  selectedProvider === "openrouter" &&
                  Boolean(isOpenRouterLocked) &&
                  group.id === "all";
                return (
                  <SelectGroup key={group.id}>
                    <SelectLabel className="px-1">
                      <button
                        type="button"
                        className="inline-flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-[11px] uppercase tracking-wide text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.preventDefault();
                          setExpandedModelGroups((prev) => ({
                            ...prev,
                            [group.id]: !isExpanded,
                          }));
                        }}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          {group.label}
                        </span>
                        <span className="text-[10px] normal-case text-muted-foreground/80">
                          {group.models.length}
                        </span>
                      </button>
                    </SelectLabel>
                    {isExpanded && isAllModelsLockedGroup ? (
                      <OpenRouterLockedCatalogNotice />
                    ) : null}
                    {isExpanded &&
                      !isAllModelsLockedGroup &&
                      group.models.map((model) => {
                        const modelTier =
                          model.provider === "anthropic"
                            ? getAnthropicModelCostTier(model.id)
                            : null;
                        return (
                          <SelectItem
                            key={`${group.id}-${model.id}`}
                            value={model.id}
                            disabled={model.availability !== "available"}
                          >
                            <ModelOptionContent
                              label={model.label}
                              recommendationRank={
                                showOpenRouterRanking
                                  ? model.recommendationRank
                                  : undefined
                              }
                              tier={modelTier}
                              isFree={
                                selectedProvider === "openrouter"
                                  ? model.isFree
                                  : false
                              }
                              showRanking={showOpenRouterRanking}
                            />
                          </SelectItem>
                        );
                      })}
                    {isExpanded &&
                      !isAllModelsLockedGroup &&
                      group.id === "all" &&
                      group.hasMore &&
                      selectedProvider === "openrouter" &&
                      onLoadAllOpenRouterModels && (
                        <div className="px-2 py-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 w-full text-xs"
                            onClick={onLoadAllOpenRouterModels}
                            disabled={isLoadingOpenRouterAllModels}
                          >
                            {isLoadingOpenRouterAllModels
                              ? "Loading models..."
                              : "Load full OpenRouter catalog"}
                          </Button>
                        </div>
                      )}
                  </SelectGroup>
                );
              })}
            </div>
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Mode
        <Select
          value={selectedMode}
          onValueChange={(value) => value && onModeChange(value)}
        >
          <SelectTrigger className="w-full bg-surface border-border h-10">
            <SelectValue>
              {selectedModeOption ? (
                <ModeOptionContent mode={selectedModeOption} />
              ) : (
                selectedMode
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {modes.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                <ModeOptionContent mode={mode} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <TooltipProvider delay={140}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-testid="mobile-clear-chat-button"
                type="button"
                variant="outline"
                className="justify-start"
                onClick={onClear}
                aria-label="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
                Clear chat history
              </Button>
            }
          />
          <TooltipContent side="top" className="max-w-[18rem] leading-snug">
            {CLEAR_CHAT_TOOLTIP_TEXT}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function DesktopChatControls(props: SharedControlProps) {
  const [desktopModelSearch, setDesktopModelSearch] = useState("");
  const [desktopExpandedModelGroups, setDesktopExpandedModelGroups] = useState<
    Record<string, boolean>
  >({});
  const selectedDesktopProvider = props.providers.find(
    (provider) => provider.id === props.selectedProvider,
  );
  const selectedDesktopModel = props.models.find(
    (model) => model.id === props.selectedModel,
  );
  const selectedDesktopMode = props.modes.find(
    (mode) => mode.value === props.selectedMode,
  );
  const showOpenRouterRanking = props.selectedProvider === "openrouter";
  const desktopFilteredModelGroups = useMemo(() => {
    const groups =
      props.modelGroups && props.modelGroups.length > 0
        ? props.modelGroups
        : [
            {
              id: "all",
              label: "Models",
              models: props.models,
              hasMore: false,
            },
          ];
    const query = desktopModelSearch.trim().toLowerCase();
    if (!query) return groups;
    return groups
      .map((group) => ({
        ...group,
        models: group.models.filter(
          (model) =>
            model.id.toLowerCase().includes(query) ||
            model.label.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.models.length > 0);
  }, [props.modelGroups, props.models, desktopModelSearch]);
  const selectedDesktopTier =
    selectedDesktopModel?.provider === "anthropic"
      ? getAnthropicModelCostTier(selectedDesktopModel.id)
      : null;
  const hasDesktopModelSearch = desktopModelSearch.trim().length > 0;

  return (
    <div className="hidden xl:flex items-center gap-2">
      <Select
        value={props.selectedProvider}
        onValueChange={(value) =>
          props.onProviderChange(value as "openrouter" | "anthropic")
        }
      >
        <SelectTrigger
          data-testid="desktop-provider-select"
          className={`w-52 bg-surface border-border h-9 ${PROVIDER_TRIGGER_CLASS}`}
        >
          <SelectValue>
            {selectedDesktopProvider ? (
              <ProviderOptionLabel
                provider={selectedDesktopProvider}
                openRouterLocked={Boolean(props.isOpenRouterLocked)}
              />
            ) : (
              "Provider"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="start"
          sideOffset={2}
          className={PROVIDER_SELECT_CONTENT_CLASS}
        >
          {props.providers.map((provider) => (
            <SelectItem
              key={provider.id}
              value={provider.id}
              disabled={provider.availability !== "available"}
              data-testid={`provider-option-${provider.id}`}
            >
              <ProviderOptionLabel
                provider={provider}
                openRouterLocked={Boolean(props.isOpenRouterLocked)}
              />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={props.selectedModel}
        onValueChange={(value) => value && props.onModelChange(value)}
      >
        <SelectTrigger
          className={`${showOpenRouterRanking ? "w-56" : "w-48"} bg-surface border-border h-9 ${MODEL_TRIGGER_CLASS}`}
        >
          <SelectValue>
            {selectedDesktopModel ? (
              <ModelOptionContent
                label={selectedDesktopModel.label}
                recommendationRank={
                  showOpenRouterRanking
                    ? selectedDesktopModel.recommendationRank
                    : undefined
                }
                tier={selectedDesktopTier}
                isFree={
                  props.selectedProvider === "openrouter"
                    ? selectedDesktopModel.isFree
                    : false
                }
                showRanking={showOpenRouterRanking}
                reserveRankingSlot={false}
              />
            ) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="end"
          className={
            showOpenRouterRanking
              ? MODEL_SELECT_CONTENT_CLASS
              : MODEL_SELECT_CONTENT_COMPACT_CLASS
          }
        >
          <div className="sticky top-0 z-10 bg-popover">
            <ModelProviderTips provider={props.selectedProvider} />
            {props.selectedProvider === "openrouter" && (
              <div className="px-2 pb-2">
                <Input
                  value={desktopModelSearch}
                  onChange={(event) =>
                    setDesktopModelSearch(event.target.value)
                  }
                  onKeyDown={stopSelectTypeaheadEvent}
                  onKeyUp={stopSelectTypeaheadEvent}
                  placeholder="Search OpenRouter models"
                  aria-label="Search OpenRouter models"
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
          <div className="max-h-[min(72vh,42rem)] overflow-y-auto overscroll-contain px-1 pb-1">
            {desktopFilteredModelGroups.map((group) => {
              const isExpanded =
                hasDesktopModelSearch ||
                (desktopExpandedModelGroups[group.id] ??
                  isGroupExpandedByDefault(props.selectedProvider, group.id));
              const isAllModelsLockedGroup =
                props.selectedProvider === "openrouter" &&
                Boolean(props.isOpenRouterLocked) &&
                group.id === "all";
              return (
                <SelectGroup key={group.id}>
                  <SelectLabel className="px-1">
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-[11px] uppercase tracking-wide text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        event.preventDefault();
                        setDesktopExpandedModelGroups((prev) => ({
                          ...prev,
                          [group.id]: !isExpanded,
                        }));
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {group.label}
                      </span>
                      <span className="text-[10px] normal-case text-muted-foreground/80">
                        {group.models.length}
                      </span>
                    </button>
                  </SelectLabel>
                  {isExpanded && isAllModelsLockedGroup ? (
                    <OpenRouterLockedCatalogNotice />
                  ) : null}
                  {isExpanded &&
                    !isAllModelsLockedGroup &&
                    group.models.map((model) => {
                      const modelTier =
                        model.provider === "anthropic"
                          ? getAnthropicModelCostTier(model.id)
                          : null;
                      return (
                        <SelectItem
                          key={`${group.id}-${model.id}`}
                          value={model.id}
                          disabled={model.availability !== "available"}
                        >
                          <ModelOptionContent
                            label={model.label}
                            recommendationRank={
                              showOpenRouterRanking
                                ? model.recommendationRank
                                : undefined
                            }
                            tier={modelTier}
                            isFree={
                              props.selectedProvider === "openrouter"
                                ? model.isFree
                                : false
                            }
                            showRanking={showOpenRouterRanking}
                          />
                        </SelectItem>
                      );
                    })}
                  {isExpanded &&
                    !isAllModelsLockedGroup &&
                    group.id === "all" &&
                    group.hasMore &&
                    props.selectedProvider === "openrouter" &&
                    props.onLoadAllOpenRouterModels && (
                      <div className="px-2 py-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 w-full text-xs"
                          onClick={props.onLoadAllOpenRouterModels}
                          disabled={props.isLoadingOpenRouterAllModels}
                        >
                          {props.isLoadingOpenRouterAllModels
                            ? "Loading models..."
                            : "Load full OpenRouter catalog"}
                        </Button>
                      </div>
                    )}
                </SelectGroup>
              );
            })}
          </div>
        </SelectContent>
      </Select>

      <Select
        value={props.selectedMode}
        onValueChange={(value) => value && props.onModeChange(value)}
      >
        <SelectTrigger className="w-40 bg-surface border-border h-9">
          <SelectValue>
            {selectedDesktopMode ? (
              <ModeOptionContent mode={selectedDesktopMode} />
            ) : (
              props.selectedMode
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {props.modes.map((mode) => (
            <SelectItem key={mode.value} value={mode.value}>
              <ModeOptionContent mode={mode} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TooltipProvider delay={140}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                data-testid="desktop-clear-chat-button"
                type="button"
                variant="ghost"
                size="sm"
                onClick={props.onClear}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-danger/35 bg-gradient-to-r from-danger/20 via-danger/10 to-danger/5 text-danger shadow-[0_8px_24px_rgb(239_68_68_/_0.2)] backdrop-blur hover:border-danger/55 hover:from-danger/25 hover:to-danger/10"
                aria-label="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent side="top" className="max-w-[18rem] leading-snug">
            {CLEAR_CHAT_TOOLTIP_TEXT}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

type ResponsiveChatControlsProps = SharedControlProps & {
  triggerClassName?: string;
  triggerContent?: ReactNode;
  triggerAriaLabel?: string;
};

export function ResponsiveChatControls(props: ResponsiveChatControlsProps) {
  const [open, setOpen] = useState(false);
  const [isTabletUp, setIsTabletUp] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsTabletUp(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            className={
              props.triggerClassName ??
              "inline-flex xl:hidden h-8 items-center gap-1.5 rounded-xl border border-plan/35 bg-gradient-to-r from-plan/20 via-plan/10 to-plan/5 px-2.5 text-xs font-display font-semibold text-plan shadow-[0_8px_24px_rgb(244_63_94_/_0.2)] backdrop-blur hover:border-plan/55 hover:from-plan/25 hover:to-plan/10"
            }
            aria-label={props.triggerAriaLabel ?? "Open chat controls"}
          />
        }
      >
        {props.triggerContent ?? (
          <>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg bg-plan/20 ring-1 ring-plan/35">
              <Settings2 className="h-3 w-3" />
            </span>
            Controls
          </>
        )}
      </SheetTrigger>
      <SheetContent
        side={isTabletUp ? "right" : "bottom"}
        className={
          isTabletUp
            ? "w-[26rem] border-l border-border"
            : "max-h-[85dvh] rounded-t-2xl border-t border-border"
        }
      >
        <SheetHeader className="pb-0">
          <SheetTitle>Chat Controls</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <ControlsBody
            {...props}
            onProviderChange={(value) => {
              props.onProviderChange(value);
              if (!isTabletUp) setOpen(false);
            }}
            onModelChange={(value) => {
              props.onModelChange(value);
              if (!isTabletUp) setOpen(false);
            }}
            onModeChange={(value) => {
              props.onModeChange(value);
              if (!isTabletUp) setOpen(false);
            }}
            onClear={() => {
              props.onClear();
              setOpen(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
