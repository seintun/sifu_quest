'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
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
import { getAnthropicModelCostTier } from '@/lib/chat-provider-config'
import type { ChatModelOption, ChatProviderOption } from '@/hooks/useChat'
import { Coins, Medal, Settings2, Sparkles, Trash2, Trophy } from 'lucide-react'
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
  const selectedModelOption = useMemo(() => models.find((model) => model.id === selectedModel), [models, selectedModel])
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
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {providers.map((provider) => (
              <SelectItem
                key={provider.id}
                value={provider.id}
                data-testid={`provider-option-${provider.id}`}
                disabled={provider.availability !== 'available'}
              >
                {provider.availability === 'available' ? provider.label : `${provider.label} (key required)`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Model
        <Select value={selectedModel} onValueChange={(value) => value && onModelChange(value)}>
          <SelectTrigger className="w-full bg-surface border-border h-10">
            <SelectValue>
              {selectedModelOption ? (
                <span className="inline-flex items-center gap-1.5">
                  <span>{selectedModelOption.label}</span>
                  {selectedTier && <CostTierIcons tier={selectedTier} />}
                  <RecommendationBadge rank={selectedModelOption.recommendationRank} />
                </span>
              ) : 'Model'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {models.map((model) => {
              const modelTier = model.provider === 'anthropic' ? getAnthropicModelCostTier(model.id) : null
              return (
                <SelectItem key={model.id} value={model.id} disabled={model.availability !== 'available'}>
                  <span className="inline-flex items-center gap-1.5">
                    <span>{model.label}</span>
                    {modelTier && <CostTierIcons tier={modelTier} />}
                    <RecommendationBadge rank={model.recommendationRank} />
                  </span>
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
            <SelectValue>{modes.find((mode) => mode.value === selectedMode)?.label ?? selectedMode}</SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {modes.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <Button data-testid="mobile-clear-chat-button" type="button" variant="outline" className="justify-start" onClick={onClear}>
        <Trash2 className="h-4 w-4" />
        Clear chat history
      </Button>
    </div>
  )
}

export function DesktopChatControls(props: SharedControlProps) {
  return (
    <div className="hidden lg:flex items-center gap-2">
      <Select value={props.selectedProvider} onValueChange={(value) => props.onProviderChange(value as 'openrouter' | 'anthropic')}>
        <SelectTrigger data-testid="desktop-provider-select" className="w-36 bg-surface border-border h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {props.providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id} disabled={provider.availability !== 'available'} data-testid={`provider-option-${provider.id}`}>
              {provider.availability === 'available' ? provider.label : `${provider.label} (key required)`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={props.selectedModel} onValueChange={(value) => value && props.onModelChange(value)}>
        <SelectTrigger className="w-56 bg-surface border-border h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {props.models.map((model) => {
            const modelTier = model.provider === 'anthropic' ? getAnthropicModelCostTier(model.id) : null
            return (
              <SelectItem key={model.id} value={model.id} disabled={model.availability !== 'available'}>
                <span className="inline-flex items-center gap-1.5">
                  <span>{model.label}</span>
                  {modelTier && <CostTierIcons tier={modelTier} />}
                  <RecommendationBadge rank={model.recommendationRank} />
                </span>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      <Select value={props.selectedMode} onValueChange={(value) => value && props.onModeChange(value)}>
        <SelectTrigger className="w-40 bg-surface border-border h-9">
          <SelectValue>{props.modes.find((mode) => mode.value === props.selectedMode)?.label ?? props.selectedMode}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {props.modes.map((mode) => (
            <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button data-testid="desktop-clear-chat-button" variant="ghost" size="sm" onClick={props.onClear} className="text-muted-foreground hover:text-danger" aria-label="Clear chat history">
        <Trash2 className="h-4 w-4" />
      </Button>
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
