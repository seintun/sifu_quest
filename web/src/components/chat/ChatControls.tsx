'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getAnthropicModelCostTier } from '@/lib/chat-provider-config'
import type { ChatModelOption, ChatProviderOption } from '@/hooks/useChat'
import { Briefcase, Coins, Lightbulb, LockKeyhole, Medal, MessageSquare, Network, Settings2, Sparkles, Trash2, Trophy } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

export type ModeOption = {
  value: string
  label: string
}

type SharedControlProps = {
  providers: ChatProviderOption[]
  selectedProvider: 'openrouter' | 'anthropic'
  onProviderChange: (value: 'openrouter' | 'anthropic') => void
  models: ChatModelOption[]
  selectedModel: string
  onModelChange: (value: string) => void
  modes: ModeOption[]
  selectedMode: string
  onModeChange: (value: string) => void
  onClear: () => void
  byokNotice?: string | null
}

const MODEL_SELECT_CONTENT_CLASS = 'w-[min(32rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-x-auto'
const MODEL_SELECT_CONTENT_MOBILE_CLASS = 'w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-auto'
const MODEL_TRIGGER_CLASS = '[&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:items-center'
const PROVIDER_SELECT_CONTENT_CLASS = 'min-w-[16rem]'
const CLEAR_CHAT_TOOLTIP_TEXT = 'Clears all messages in this chat session.'

function formatProviderLabel(provider: Pick<ChatProviderOption, 'id' | 'label'>): string {
  if (provider.id === 'openrouter') return 'OpenRouter'
  if (provider.id === 'anthropic') return 'Anthropic'
  return provider.label
}

function CostTierIcons({ tier }: { tier: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-1 text-warning">
      <Coins className="h-3 w-3" />
      <span className="text-[11px] leading-none font-medium">x{tier}</span>
    </span>
  )
}

function RecommendationBadge({ rank }: { rank?: number }) {
  if (!rank) return null
  const Icon = rank === 1 ? Trophy : rank <= 3 ? Medal : Sparkles
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary">
      <Icon className="h-2.5 w-2.5" />
      <span>#{rank}</span>
    </span>
  )
}

function RecommendationBadgeSlot({ rank }: { rank?: number }) {
  return (
    <span className="inline-flex min-h-6 w-[3.35rem] items-center justify-start">
      {rank ? <RecommendationBadge rank={rank} /> : null}
    </span>
  )
}

function ModelRankingTips() {
  return (
    <>
      <SelectGroup>
        <SelectLabel className="text-[11px] leading-tight text-muted-foreground">
          Ranking: lower # is better (#1 best).
        </SelectLabel>
        <SelectLabel className="pt-0 text-[11px] leading-tight text-muted-foreground">
          Source:
          {' '}
          <a
            href="https://openrouter.ai/rankings?category=programming#categories"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            openrouter.ai/rankings
          </a>
          {' '}• Icon + # for accessibility.
        </SelectLabel>
      </SelectGroup>
      <SelectSeparator />
    </>
  )
}

function ModelOptionContent({
  label,
  recommendationRank,
  tier,
}: {
  label: string
  recommendationRank?: number
  tier?: 1 | 2 | 3 | null
}) {
  return (
    <span className="grid w-full grid-cols-[3.35rem_minmax(0,1fr)_auto] items-center gap-2">
      <RecommendationBadgeSlot rank={recommendationRank} />
      <span className="min-w-0 truncate whitespace-nowrap leading-tight">{label}</span>
      {tier ? <CostTierIcons tier={tier} /> : <span />}
    </span>
  )
}

function ProviderOptionLabel({ provider }: { provider: ChatProviderOption }) {
  const label = formatProviderLabel(provider)

  if (provider.availability === 'available') {
    return <span>{label}</span>
  }

  return (
    <span className="inline-flex items-center gap-1.5 leading-none">
      <LockKeyhole className="h-3.5 w-3.5 text-warning" />
      <span>{label} (key required)</span>
    </span>
  )
}

function ModeOptionContent({ mode }: { mode: ModeOption }) {
  const source = `${mode.value.toLowerCase()} ${mode.label.toLowerCase()}`
  const Icon = source.includes('system')
    ? Network
    : source.includes('interview')
      ? MessageSquare
      : source.includes('job')
      ? Briefcase
      : source.includes('business')
        ? Lightbulb
        : Medal

  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{mode.label}</span>
    </span>
  )
}

function ControlsBody({
  providers,
  selectedProvider,
  onProviderChange,
  models,
  selectedModel,
  onModelChange,
  modes,
  selectedMode,
  onModeChange,
  onClear,
  byokNotice,
}: SharedControlProps) {
  const selectedProviderOption = useMemo(
    () => providers.find((provider) => provider.id === selectedProvider),
    [providers, selectedProvider],
  )
  const selectedModelOption = useMemo(() => models.find((model) => model.id === selectedModel), [models, selectedModel])
  const selectedModeOption = useMemo(() => modes.find((mode) => mode.value === selectedMode), [modes, selectedMode])
  const selectedTier = selectedModelOption?.provider === 'anthropic'
    ? getAnthropicModelCostTier(selectedModelOption.id)
    : null

  return (
    <div className="grid gap-3">
      {byokNotice && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-[11px] text-warning flex items-center justify-between gap-2">
          <span className="truncate">{byokNotice}</span>
          <Link href="/settings" className="underline underline-offset-2 whitespace-nowrap hover:text-warning/90 shrink-0">
            Settings
          </Link>
        </div>
      )}

      <label className="grid gap-1 text-xs text-muted-foreground">
        Provider
        <Select value={selectedProvider} onValueChange={(value) => onProviderChange(value as 'openrouter' | 'anthropic')}>
          <SelectTrigger data-testid="mobile-provider-select" className="w-full bg-surface border-border h-10">
            <SelectValue>
              {selectedProviderOption ? formatProviderLabel(selectedProviderOption) : 'Provider'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} sideOffset={8} className={PROVIDER_SELECT_CONTENT_CLASS}>
            {providers.map((provider) => (
              <SelectItem
                key={provider.id}
                value={provider.id}
                data-testid={`provider-option-${provider.id}`}
                disabled={provider.availability !== 'available'}
              >
                <ProviderOptionLabel provider={provider} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Model
        <Select value={selectedModel} onValueChange={(value) => value && onModelChange(value)}>
          <SelectTrigger className={`w-full bg-surface border-border h-10 ${MODEL_TRIGGER_CLASS}`}>
            <SelectValue>
              {selectedModelOption ? (
                <ModelOptionContent
                  label={selectedModelOption.label}
                  recommendationRank={selectedModelOption.recommendationRank}
                  tier={selectedTier}
                />
              ) : 'Model'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            alignItemWithTrigger={false}
            align="end"
            className={MODEL_SELECT_CONTENT_MOBILE_CLASS}
          >
            <ModelRankingTips />
            {models.map((model) => {
              const modelTier = model.provider === 'anthropic' ? getAnthropicModelCostTier(model.id) : null
              return (
                <SelectItem key={model.id} value={model.id} disabled={model.availability !== 'available'}>
                  <ModelOptionContent
                    label={model.label}
                    recommendationRank={model.recommendationRank}
                    tier={modelTier}
                  />
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Mode
        <Select value={selectedMode} onValueChange={(value) => value && onModeChange(value)}>
          <SelectTrigger className="w-full bg-surface border-border h-10">
            <SelectValue>
              {selectedModeOption ? <ModeOptionContent mode={selectedModeOption} /> : selectedMode}
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
            render={(
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
            )}
          />
          <TooltipContent side="top" className="max-w-[18rem] leading-snug">
            {CLEAR_CHAT_TOOLTIP_TEXT}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

export function DesktopChatControls(props: SharedControlProps) {
  const selectedDesktopProvider = props.providers.find((provider) => provider.id === props.selectedProvider)
  const selectedDesktopModel = props.models.find((model) => model.id === props.selectedModel)
  const selectedDesktopMode = props.modes.find((mode) => mode.value === props.selectedMode)
  const selectedDesktopTier = selectedDesktopModel?.provider === 'anthropic'
    ? getAnthropicModelCostTier(selectedDesktopModel.id)
    : null

  return (
    <div className="hidden lg:flex items-center gap-2">
      <Select value={props.selectedProvider} onValueChange={(value) => props.onProviderChange(value as 'openrouter' | 'anthropic')}>
        <SelectTrigger data-testid="desktop-provider-select" className="w-36 bg-surface border-border h-9">
          <SelectValue>
            {selectedDesktopProvider ? formatProviderLabel(selectedDesktopProvider) : 'Provider'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} sideOffset={8} className={PROVIDER_SELECT_CONTENT_CLASS}>
          {props.providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id} disabled={provider.availability !== 'available'} data-testid={`provider-option-${provider.id}`}>
              <ProviderOptionLabel provider={provider} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={props.selectedModel} onValueChange={(value) => value && props.onModelChange(value)}>
        <SelectTrigger className={`w-56 bg-surface border-border h-9 ${MODEL_TRIGGER_CLASS}`}>
          <SelectValue>
            {selectedDesktopModel ? (
              <ModelOptionContent
                label={selectedDesktopModel.label}
                recommendationRank={selectedDesktopModel.recommendationRank}
                tier={selectedDesktopTier}
              />
            ) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          align="end"
          className={MODEL_SELECT_CONTENT_CLASS}
          >
            <ModelRankingTips />
          {props.models.map((model) => {
            const modelTier = model.provider === 'anthropic' ? getAnthropicModelCostTier(model.id) : null
            return (
              <SelectItem key={model.id} value={model.id} disabled={model.availability !== 'available'}>
                <ModelOptionContent
                  label={model.label}
                  recommendationRank={model.recommendationRank}
                  tier={modelTier}
                />
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <Select value={props.selectedMode} onValueChange={(value) => value && props.onModeChange(value)}>
        <SelectTrigger className="w-40 bg-surface border-border h-9">
          <SelectValue>
            {selectedDesktopMode ? <ModeOptionContent mode={selectedDesktopMode} /> : props.selectedMode}
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
            render={(
              <Button
                data-testid="desktop-clear-chat-button"
                type="button"
                variant="ghost"
                size="sm"
                onClick={props.onClear}
                className="text-muted-foreground hover:text-danger"
                aria-label="Clear chat history"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          />
          <TooltipContent side="top" className="max-w-[18rem] leading-snug">
            {CLEAR_CHAT_TOOLTIP_TEXT}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

export function ResponsiveChatControls(props: SharedControlProps) {
  const [open, setOpen] = useState(false)
  const [isTabletUp, setIsTabletUp] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const apply = () => setIsTabletUp(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<button className="inline-flex lg:hidden items-center gap-1.5 rounded-lg border border-border px-2.5 h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-elevated" aria-label="Open chat controls" />}
      >
        <Settings2 className="h-3.5 w-3.5" />
        Controls
      </SheetTrigger>
      <SheetContent
        side={isTabletUp ? 'right' : 'bottom'}
        className={isTabletUp ? 'w-[26rem] border-l border-border' : 'max-h-[85dvh] rounded-t-2xl border-t border-border'}
      >
        <SheetHeader className="pb-0">
          <SheetTitle>Chat Controls</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          <ControlsBody
            {...props}
            onProviderChange={(value) => {
              props.onProviderChange(value)
              if (!isTabletUp) setOpen(false)
            }}
            onModelChange={(value) => {
              props.onModelChange(value)
              if (!isTabletUp) setOpen(false)
            }}
            onModeChange={(value) => {
              props.onModeChange(value)
              if (!isTabletUp) setOpen(false)
            }}
            onClear={() => {
              props.onClear()
              setOpen(false)
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
