'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { DOJO_TITLE_ROLL_EFFECT_MS, generateDojoTitlePhrase } from '@/lib/dojo-title'
import { cn } from '@/lib/utils'
import {
  type OnboardingCoreAnswers,
  type OnboardingDraftPayload,
  type OnboardingEnrichmentAnswers,
  GOAL_OPTIONS,
  HOURS_PER_WEEK_OPTIONS,
  INTERVIEW_LANGUAGE_OPTIONS,
  ONBOARDING_DRAFT_STORAGE_KEY,
  ONBOARDING_MAX_NAME_LENGTH,
  ONBOARDING_SCHEMA_VERSION,
  SITUATION_OPTIONS,
  TARGET_ROLE_OPTIONS,
  TIMELINE_OPTIONS,
  WEAKNESS_OPTIONS,
  createEmptyCoreAnswers,
  createEmptyEnrichmentAnswers,
} from '@/lib/onboarding-v2'
import { getOnboardingCoreSteps, isCoreStepComplete, type OnboardingCoreStepKey } from '@/lib/onboarding-flow'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dice5 } from 'lucide-react'

type OnboardingStatusResponse = {
  onboarding?: {
    status?: 'not_started' | 'in_progress' | 'core_complete' | 'enriched_complete'
    draftAvailable?: boolean
  }
  draft?: OnboardingDraftPayload
}

type AccountStatusResponse = {
  account?: {
    displayName?: string | null
    prefillName?: string | null
  }
}

type ApiErrorPayload = {
  error?: string
  code?: string
  requestId?: string
}

function formatApiError(payload: ApiErrorPayload | null | undefined, fallback: string): string {
  if (!payload) {
    return fallback
  }
  const parts = [
    payload.error?.trim() || fallback,
    payload.code ? `code: ${payload.code}` : null,
    payload.requestId ? `requestId: ${payload.requestId}` : null,
  ].filter(Boolean)
  return parts.join(' | ')
}

function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function readLocalDraft(): OnboardingDraftPayload | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    return parsed as OnboardingDraftPayload
  } catch {
    return null
  }
}

function writeLocalDraft(draft: OnboardingDraftPayload): void {
  try {
    localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Best-effort local persistence.
  }
}

function clearLocalDraft(): void {
  try {
    localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY)
  } catch {
    // Best-effort local persistence.
  }
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      data-testid={`chip-${label.toLowerCase().replace(/\s+/g, '-')}`}
      type="button"
      onClick={onClick}
      className={cn(
        'px-3.5 py-1.5 rounded-full text-sm border transition-all duration-150 cursor-pointer',
        active
          ? 'bg-primary text-primary-foreground border-primary font-medium'
          : 'bg-surface border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
      )}
    >
      {label}
    </button>
  )
}

function OnboardingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center -m-6 animate-pulse">
      <div className="w-full max-w-2xl p-8">
        <div className="mb-8 space-y-3">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted/60 rounded" />
          <div className="mt-3 h-1.5 w-full bg-muted rounded-full" />
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-10 w-full bg-muted/50 rounded-md" />
          </div>
        </div>

        <div className="flex justify-between mt-8">
          <div className="h-10 w-20 bg-muted/40 rounded-md" />
          <div className="h-10 w-20 bg-muted/80 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [booting, setBooting] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [core, setCore] = useState<OnboardingCoreAnswers>(createEmptyCoreAnswers())
  const [enrichment, setEnrichment] = useState<OnboardingEnrichmentAnswers>(createEmptyEnrichmentAnswers())
  const [stepIndex, setStepIndex] = useState(0)
  const [isGeneratingName, setIsGeneratingName] = useState(false)
  const generateNameResetTimerRef = useRef<number | null>(null)

  const steps = useMemo(() => getOnboardingCoreSteps(core), [core])
  const currentStep = steps[Math.min(stepIndex, Math.max(steps.length - 1, 0))]
  const progress = steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0

  // Ensure a NextAuth session exists (auto anonymous sign-in).
  async function ensureSession(): Promise<void> {
    const res = await fetch('/api/auth/session')
    const session = await res.json()
    if (session?.user?.id) return

    const csrfRes = await fetch('/api/auth/csrf')
    const { csrfToken } = await csrfRes.json()
    await fetch('/api/auth/callback/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, json: 'true' }),
    })
  }

  function toggleMultiValue(
    currentValues: string[],
    value: string,
    maxCount: number,
  ): string[] {
    if (currentValues.includes(value)) {
      return currentValues.filter((item) => item !== value)
    }
    if (currentValues.length >= maxCount) {
      return currentValues
    }
    return [...currentValues, value]
  }

  function isCurrentStepComplete(step: OnboardingCoreStepKey): boolean {
    return isCoreStepComplete(step, core)
  }

  function runDojoNameRollEffect(): void {
    setIsGeneratingName(true)
    if (generateNameResetTimerRef.current !== null) {
      window.clearTimeout(generateNameResetTimerRef.current)
    }
    generateNameResetTimerRef.current = window.setTimeout(() => {
      setIsGeneratingName(false)
      generateNameResetTimerRef.current = null
    }, DOJO_TITLE_ROLL_EFFECT_MS)
  }

  async function handleSubmitCore(): Promise<void> {
    setSubmitting(true)
    try {
      await ensureSession()

      const response = await fetch('/api/onboarding/core/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          core,
          enrichment,
          currentStep: stepIndex,
        }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Session Expired', {
            description: 'Your session expired. Reloading so you can continue onboarding.',
          })
          if (typeof window !== 'undefined') {
            window.location.reload()
          }
          return
        }
        const data = (await response.json().catch(() => null)) as ApiErrorPayload | null
        toast.error('Onboarding Failed', {
          description: formatApiError(data, 'Please review your answers and try again.'),
        })
        return
      }

      clearLocalDraft()
      router.push('/')
    } catch {
      toast.error('Connection Error', { description: 'Failed to submit onboarding. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        await ensureSession()

        const [statusRes, accountRes] = await Promise.all([
          fetch('/api/onboarding/status'),
          fetch('/api/account/status'),
        ])

        const statusData: OnboardingStatusResponse = statusRes.ok ? await statusRes.json() : {}
        if (statusData.onboarding?.status === 'core_complete' || statusData.onboarding?.status === 'enriched_complete') {
          router.replace('/')
          return
        }

        const serverDraft = statusData.draft
        const localDraft = readLocalDraft()
        const activeDraft = serverDraft ?? localDraft

        if (activeDraft) {
          setEnrichment((prev) => ({ ...prev, ...activeDraft.enrichment }))
          setStepIndex(Math.max(0, activeDraft.currentStep ?? 0))
        }

        let namePrefill = ''
        if (accountRes.ok) {
          const accountData = (await accountRes.json()) as AccountStatusResponse
          namePrefill = accountData.account?.displayName || accountData.account?.prefillName || ''
        }

        setCore((prev) => {
          const merged = activeDraft ? { ...prev, ...activeDraft.core } : prev
          if (merged.name.trim()) {
            return merged
          }

          if (namePrefill) {
            return { ...merged, name: toTitleCase(namePrefill) }
          }

          return { ...merged, name: generateDojoTitlePhrase() }
        })
      } catch (error) {
        console.error('[onboarding/bootstrap] failed to load onboarding context', error)
        toast.error('Setup Error', {
          description: 'Unable to initialize onboarding context. Refresh and try again.',
        })
      } finally {
        setBooting(false)
        setHydrated(true)
      }
    }

    void bootstrap()
  }, [router])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    const nextStepIndex = Math.min(stepIndex, Math.max(steps.length - 1, 0))
    if (nextStepIndex !== stepIndex) {
      setStepIndex(nextStepIndex)
    }
  }, [hydrated, stepIndex, steps.length])

  useEffect(() => {
    if (!hydrated) {
      return
    }

    const draft: OnboardingDraftPayload = {
      schemaVersion: ONBOARDING_SCHEMA_VERSION,
      core,
      enrichment,
      currentStep: stepIndex,
    }
    writeLocalDraft(draft)

    const timer = setTimeout(() => {
      void fetch('/api/onboarding/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      }).catch(() => {
        console.warn('[onboarding/draft] autosave failed; local draft preserved')
      })
    }, 400)

    return () => clearTimeout(timer)
  }, [core, enrichment, hydrated, stepIndex])

  useEffect(() => {
    return () => {
      if (generateNameResetTimerRef.current !== null) {
        window.clearTimeout(generateNameResetTimerRef.current)
      }
    }
  }, [])

  if (booting) {
    return <OnboardingSkeleton />
  }

  if (submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center -m-6">
        <div className="w-full max-w-lg p-8 text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <h1 className="font-display text-2xl font-bold mb-3">Finalizing your setup...</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We are saving your profile and queueing your personalized plan in the background.
          </p>
        </div>
      </div>
    )
  }

  const complete = isCurrentStepComplete(currentStep)

  return (
    <div className="min-h-screen flex items-center justify-center -m-6">
      <div className="w-full max-w-2xl p-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold mb-2">Set up your workspace</h1>
          <p className="text-muted-foreground text-sm">Step {stepIndex + 1} of {steps.length}</p>
          <Progress value={progress} className="mt-3 h-1.5" />
        </div>

        <div className="animate-fade-in space-y-5" data-testid={`onboarding-step-${currentStep}`}>
          {currentStep === 'name' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="name-input" className="block text-lg font-medium">What should we call you?</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn('transition-transform duration-200', isGeneratingName && 'scale-[1.03]')}
                  aria-label="Generate a random dojo name"
                  title="Generate a random dojo name"
                  onClick={() => {
                    setCore((prev) => ({ ...prev, name: generateDojoTitlePhrase() }))
                    runDojoNameRollEffect()
                  }}
                >
                  <Dice5 className={cn('h-3.5 w-3.5', isGeneratingName && 'animate-spin')} aria-hidden="true" />
                  Generate My Dojo Name
                </Button>
              </div>
              <Input
                id="name-input"
                data-testid="onboarding-name-input"
                value={core.name}
                onChange={(event) => setCore((prev) => ({ ...prev, name: event.target.value }))}
                onBlur={() => setCore((prev) => ({ ...prev, name: toTitleCase(prev.name) }))}
                placeholder="Your name"
                maxLength={ONBOARDING_MAX_NAME_LENGTH}
                className={cn(
                  'bg-surface border-border transition-all duration-300',
                  isGeneratingName && 'border-primary/60 shadow-[0_0_0_3px_hsl(var(--ring)/0.18)]',
                )}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && complete) {
                    event.preventDefault()
                    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Need inspiration? Roll for a dojo name.
              </p>
              <p className="sr-only" aria-live="polite">
                {isGeneratingName ? 'New dojo name generated.' : ''}
              </p>
            </div>
          )}

          {currentStep === 'goals' && (
            <div className="space-y-3">
              <div>
                <label className="block text-lg font-medium">What are your top goals right now?</label>
                <p className="text-muted-foreground text-sm">Pick 1-2 to keep your first plan focused.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={core.goals.includes(option.value)}
                    onClick={() =>
                      setCore((prev) => ({
                        ...prev,
                        goals: toggleMultiValue(prev.goals, option.value, 2),
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {currentStep === 'context' && (
            <div className="space-y-4">
              <div>
                <label className="block text-lg font-medium">What is your current situation?</label>
                <p className="text-muted-foreground text-sm">This helps us calibrate urgency and strategy.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SITUATION_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={core.situation === option.value}
                    onClick={() => setCore((prev) => ({ ...prev, situation: option.value }))}
                  />
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Experience</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'lt_1', label: '< 1 year' },
                    { value: '1_2', label: '1-2 years' },
                    { value: '3_5', label: '3-5 years' },
                    { value: '5_8', label: '5-8 years' },
                    { value: '8_plus', label: '8+ years' },
                  ].map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      active={core.experience === option.value}
                      onClick={() => setCore((prev) => ({ ...prev, experience: option.value }))}
                    />
                  ))}
                </div>
              </div>

              <Input
                aria-label="Optional context for your situation"
                value={core.contextNote}
                onChange={(event) => setCore((prev) => ({ ...prev, contextNote: event.target.value }))}
                placeholder="Optional context (company, role scope, constraints)"
                className="bg-surface border-border text-sm"
              />
            </div>
          )}

          {currentStep === 'constraints' && (
            <div className="space-y-4">
              <div>
                <label className="block text-lg font-medium">What is your timeline and weekly capacity?</label>
                <p className="text-muted-foreground text-sm">We will scope your plan based on this.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Timeline</label>
                <div className="flex flex-wrap gap-2">
                  {TIMELINE_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      active={core.timeline === option.value}
                      onClick={() => setCore((prev) => ({ ...prev, timeline: option.value, timelineCustom: '' }))}
                    />
                  ))}
                </div>
                <Input
                  aria-label="Custom timeline"
                  value={core.timelineCustom}
                  onChange={(event) =>
                    setCore((prev) => ({
                      ...prev,
                      timelineCustom: event.target.value,
                      timeline: event.target.value ? '' : prev.timeline,
                    }))
                  }
                  placeholder="Or type your timeline in your own words"
                  className="bg-surface border-border text-sm mt-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Hours per week</label>
                <div className="flex flex-wrap gap-2">
                  {HOURS_PER_WEEK_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      active={core.hoursPerWeek === option.value}
                      onClick={() => setCore((prev) => ({ ...prev, hoursPerWeek: option.value, hoursPerWeekCustom: '' }))}
                    />
                  ))}
                </div>
                <Input
                  aria-label="Custom hours per week"
                  value={core.hoursPerWeekCustom}
                  onChange={(event) =>
                    setCore((prev) => ({
                      ...prev,
                      hoursPerWeekCustom: event.target.value,
                      hoursPerWeek: event.target.value ? '' : prev.hoursPerWeek,
                    }))
                  }
                  placeholder="Or describe your schedule"
                  className="bg-surface border-border text-sm mt-3"
                />
              </div>
            </div>
          )}

          {currentStep === 'targetRoles' && (
            <div className="space-y-3">
              <div>
                <label className="block text-lg font-medium">Which roles are you targeting?</label>
                <p className="text-muted-foreground text-sm">Pick up to 3 roles.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TARGET_ROLE_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={core.targetRoles.includes(option.value)}
                    onClick={() =>
                      setCore((prev) => ({
                        ...prev,
                        targetRoles: toggleMultiValue(prev.targetRoles, option.value, 3),
                      }))
                    }
                  />
                ))}
              </div>
              <Input
                aria-label="Custom role"
                value={core.targetRolesCustom}
                onChange={(event) => setCore((prev) => ({ ...prev, targetRolesCustom: event.target.value }))}
                placeholder="Or add a custom role"
                className="bg-surface border-border text-sm"
              />
            </div>
          )}

          {currentStep === 'interviewLanguage' && (
            <div className="space-y-3">
              <div>
                <label className="block text-lg font-medium">Preferred interview coding language</label>
                <p className="text-muted-foreground text-sm">Pick one primary language.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {INTERVIEW_LANGUAGE_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={core.interviewLanguage === option.value}
                    onClick={() =>
                      setCore((prev) => ({
                        ...prev,
                        interviewLanguage: option.value,
                        interviewLanguageCustom: '',
                      }))
                    }
                  />
                ))}
              </div>
              <Input
                aria-label="Custom interview language"
                value={core.interviewLanguageCustom}
                onChange={(event) =>
                  setCore((prev) => ({
                    ...prev,
                    interviewLanguageCustom: event.target.value,
                    interviewLanguage: event.target.value ? '' : prev.interviewLanguage,
                  }))
                }
                placeholder="Or type your preferred language"
                className="bg-surface border-border text-sm"
              />
            </div>
          )}

          {currentStep === 'gaps' && (
            <div className="space-y-3">
              <div>
                <label className="block text-lg font-medium">What are 1-2 areas you most want to improve?</label>
                <p className="text-muted-foreground text-sm">We use this to prioritize your first milestones.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEAKNESS_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    active={core.weaknesses.includes(option.value)}
                    onClick={() =>
                      setCore((prev) => ({
                        ...prev,
                        weaknesses: toggleMultiValue(prev.weaknesses, option.value, 2),
                      }))
                    }
                  />
                ))}
              </div>
              <Input
                aria-label="Custom growth area"
                value={core.weaknessesCustom}
                onChange={(event) => setCore((prev) => ({ ...prev, weaknessesCustom: event.target.value }))}
                placeholder="Optional custom growth area"
                className="bg-surface border-border text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex justify-between mt-8">
          <Button
            data-testid="onboarding-back-button"
            variant="ghost"
            onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
            disabled={stepIndex === 0}
          >
            Back
          </Button>
          <Button
            data-testid="onboarding-next-button"
            onClick={() => {
              if (stepIndex === steps.length - 1) {
                void handleSubmitCore()
              } else {
                setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
              }
            }}
            disabled={!complete}
          >
            {stepIndex === steps.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
