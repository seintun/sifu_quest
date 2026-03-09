'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type StepBase = { key: string; question: string; hint?: string }
type InputStep    = StepBase & { type: 'input';    placeholder: string; normalize?: boolean }
type TextareaStep = StepBase & { type: 'textarea'; placeholder: string }
type ChipsStep    = StepBase & { type: 'chips';    options: string[]; multi: boolean; extraPlaceholder?: string }
type RadioStep    = StepBase & { type: 'radio';    options: string[]; customPlaceholder?: string }
type AnyStep = InputStep | TextareaStep | ChipsStep | RadioStep

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS: AnyStep[] = [
  {
    key: 'name',
    question: "What's your name?",
    type: 'input',
    placeholder: 'Your name',
    normalize: true,
  },
  {
    key: 'situation',
    question: "What's your current situation?",
    type: 'chips',
    multi: false,
    options: [
      'Actively job searching',
      'Employed & quietly looking',
      'Student / bootcamp grad',
      'Between jobs / laid off',
      'Career pivot',
      'Employed, not looking yet',
    ],
    extraPlaceholder: 'Add more context — role, company, stage, etc. (optional)',
  },
  {
    key: 'experience',
    question: 'How many years of engineering experience do you have?',
    type: 'radio',
    options: ['< 1 year', '1–2 years', '3–5 years', '5–8 years', '8+ years'],
    customPlaceholder: 'Or type exactly (e.g., "6 years full-stack")',
  },
  {
    key: 'techStack',
    question: "What's your primary tech stack?",
    type: 'chips',
    multi: true,
    options: [
      'React', 'Next.js', 'Vue', 'Angular',
      'Node.js', 'Express', 'FastAPI', 'Django', 'Spring Boot', 'Rails',
      'Python', 'TypeScript', 'JavaScript', 'Java', 'Go', 'Rust',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
      'AWS', 'GCP', 'Azure',
      'Docker', 'Kubernetes', 'GraphQL',
    ],
    hint: 'Select all that apply.',
    extraPlaceholder: 'Anything not listed? (e.g., Elixir, Terraform, Kafka)',
  },
  {
    key: 'goals',
    question: 'What are you here to work on?',
    type: 'chips',
    multi: true,
    options: [
      'DSA & LeetCode prep',
      'System design',
      'Job search strategy',
      'Behavioral interview prep',
      'Business / startup ideas',
      'General learning & leveling up',
    ],
    hint: 'Select all that apply.',
    extraPlaceholder: 'Anything else? (optional)',
  },
  {
    key: 'targetRoles',
    question: 'What roles are you targeting?',
    type: 'chips',
    multi: true,
    options: [
      'Software Engineer',
      'Senior Software Engineer',
      'Staff Engineer',
      'Frontend Engineer',
      'Backend Engineer',
      'Full-Stack Engineer',
      'Engineering Manager',
      'Tech Lead',
      'Principal Engineer',
      'Data Engineer',
    ],
    extraPlaceholder: 'Or add your own (e.g., ML Engineer, Platform Engineer)',
  },
  {
    key: 'targetCompanies',
    question: 'Target companies or tiers?',
    type: 'chips',
    multi: true,
    options: [
      'FAANG / MAANG', 'Big Tech', 'Mid-stage startups (Series B+)', 'Pre-IPO unicorns', 'Remote-first',
      'Google', 'Meta', 'Amazon', 'Apple', 'Microsoft', 'Netflix',
      'Stripe', 'Airbnb', 'Uber', 'LinkedIn', 'Shopify',
      'OpenAI', 'Anthropic', 'Coinbase', 'DoorDash',
    ],
    hint: 'Select tiers, specific companies, or both.',
    extraPlaceholder: 'Add specific companies or notes (optional)',
  },
  {
    key: 'timeline',
    question: "What's your timeline?",
    type: 'radio',
    options: ['1 month', '2 months', '3 months', '6 months', '1 year', 'Actively interviewing now', 'No hard deadline'],
    hint: 'The game plan will be calibrated to this.',
    customPlaceholder: 'Or describe your situation…',
  },
  {
    key: 'hoursPerWeek',
    question: 'How many hours per week can you realistically dedicate?',
    type: 'radio',
    options: ['< 5 hrs/week', '5–10 hrs/week', '10–15 hrs/week', '15+ hrs/week'],
    customPlaceholder: 'Or describe your schedule…',
  },
  {
    key: 'language',
    question: 'Preferred coding language for interviews?',
    type: 'chips',
    multi: true,
    options: ['Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'Go', 'Rust', 'Swift', 'Kotlin', 'C#'],
    hint: 'Select your primary, optionally add a secondary.',
    extraPlaceholder: 'Notes — e.g., primary Python, secondary JS (optional)',
  },
  {
    key: 'learningStyle',
    question: 'How do you like to learn?',
    type: 'chips',
    multi: true,
    options: [
      'Think out loud together',
      'Hints before answers',
      'Direct explanations',
      'Hand-holding & scaffolding',
      'Socratic method',
      'Show me examples first',
    ],
    extraPlaceholder: 'Anything else about how you learn best? (optional)',
  },
  {
    key: 'strengths',
    question: 'What are your 2–3 strongest technical areas?',
    type: 'chips',
    multi: true,
    options: [
      'React / Frontend', 'Node.js / Backend', 'Python', 'Java / JVM',
      'Algorithms & Data Structures', 'System Design', 'API Design',
      'SQL / Databases', 'Cloud Infrastructure', 'DevOps / CI/CD',
      'Machine Learning / AI', 'Mobile Development',
      'Testing & QA', 'Security', 'Performance Optimization', 'Microservices',
    ],
    hint: 'Pick 2–3.',
    extraPlaceholder: 'Anything else? (optional)',
  },
  {
    key: 'weaknesses',
    question: 'What are 1–2 areas you most want to improve?',
    type: 'chips',
    multi: true,
    options: [
      'DSA / LeetCode', 'System Design', 'Behavioral Interviews',
      'Distributed Systems', 'Low-level Programming', 'Machine Learning / AI',
      'Frontend / UI', 'Backend / APIs', 'DevOps / Infrastructure',
      'SQL / Databases', 'Cloud Architecture', 'Testing',
      'Communication / Tech Writing', 'Leadership & Mentoring', 'Security',
    ],
    hint: 'Pick 1–2.',
    extraPlaceholder: 'Anything else? (optional)',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// ── Chip component ────────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3.5 py-1.5 rounded-full text-sm border transition-all duration-150 cursor-pointer',
        active
          ? 'bg-primary text-primary-foreground border-primary font-medium'
          : 'bg-surface border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
      )}
    >
      {label}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  // API key phase
  const [needsApiKey, setNeedsApiKey] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [apiKeyError, setApiKeyError] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  // Profile phase
  const [step, setStep] = useState(0)
  // freeText: plain text answers (input/textarea, and extra fields on chip/radio steps)
  const [freeText, setFreeText] = useState<Record<string, string>>({})
  // chipSel: selected chip labels per step key
  const [chipSel, setChipSel] = useState<Record<string, string[]>>({})
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => setNeedsApiKey(!data.hasApiKey))
      .catch(() => setNeedsApiKey(false))
  }, [])

  // Build the final string answer for a step
  function getAnswer(s: AnyStep): string {
    const chips = chipSel[s.key] || []
    const text  = freeText[s.key] || ''
    if (s.type === 'chips' || s.type === 'radio') {
      const base = chips.join(', ')
      if (base && text) return `${base}. ${text}`
      return base || text
    }
    return text
  }

  function isStepComplete(s: AnyStep): boolean {
    return getAnswer(s).trim().length > 0
  }

  function toggleChip(key: string, label: string, multi: boolean) {
    setChipSel(prev => {
      const cur = prev[key] || []
      if (multi) {
        return { ...prev, [key]: cur.includes(label) ? cur.filter(c => c !== label) : [...cur, label] }
      } else {
        return { ...prev, [key]: cur.includes(label) ? [] : [label] }
      }
    })
  }

  const handleSaveApiKey = async () => {
    setApiKeyError('')
    setSavingKey(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })
      const data = await res.json()
      if (!res.ok) { setApiKeyError(data.error || 'Failed to save API key'); return }
      setNeedsApiKey(false)
    } finally {
      setSavingKey(false)
    }
  }

  const handleNext = async () => {
    const current = STEPS[step]

    // Normalize name on advance
    if (current.key === 'name' && freeText.name) {
      setFreeText(prev => ({ ...prev, name: toTitleCase(prev.name) }))
    }

    if (step < STEPS.length - 1) {
      setStep(step + 1)
      return
    }

    // Final step — build payload and submit
    setGenerating(true)
    try {
      const payload: Record<string, string> = {}
      for (const s of STEPS) payload[s.key] = getAnswer(s)

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) router.push('/')
    } finally {
      setGenerating(false)
    }
  }

  // ── Loading / API key screens ────────────────────────────────────────────────

  if (needsApiKey === null) {
    return <div className="min-h-screen flex items-center justify-center -m-6"><div className="text-muted-foreground">Loading...</div></div>
  }

  if (needsApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center -m-6">
        <div className="w-full max-w-lg p-8">
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold mb-2">Set up your workspace</h1>
            <p className="text-muted-foreground text-sm">Step 1 of 2 — Connect your API key</p>
            <Progress value={50} className="mt-3 h-1.5" />
          </div>
          <label className="block text-lg font-medium mb-2">Enter your Anthropic API key</label>
          <p className="text-muted-foreground text-sm mb-4">
            Get yours at <span className="text-foreground font-mono text-xs">console.anthropic.com</span>.
            Saved locally in <span className="font-mono text-xs">.env.local</span> — never leaves your machine.
          </p>
          <Input
            type="password"
            value={apiKey}
            onChange={e => { setApiKey(e.target.value); setApiKeyError('') }}
            placeholder="sk-ant-..."
            className="bg-surface border-border font-mono"
            onKeyDown={e => { if (e.key === 'Enter' && apiKey.startsWith('sk-ant-')) { e.preventDefault(); handleSaveApiKey() } }}
            autoFocus
          />
          {apiKeyError && <p className="text-destructive text-sm mt-2">{apiKeyError}</p>}
          <div className="flex justify-end mt-8">
            <Button onClick={handleSaveApiKey} disabled={!apiKey.startsWith('sk-ant-') || savingKey}>
              {savingKey ? 'Verifying...' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="min-h-screen flex items-center justify-center -m-6">
        <div className="w-full max-w-lg p-8 text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <h1 className="font-display text-2xl font-bold mb-3">Building your personalized plan…</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Claude is crafting a custom game plan based on your goals, timeline, and experience.
            This takes about 15–20 seconds.
          </p>
        </div>
      </div>
    )
  }

  // ── Profile steps ─────────────────────────────────────────────────────────────

  const current = STEPS[step]
  const progress = ((step + 1) / STEPS.length) * 100
  const chips = chipSel[current.key] || []
  const complete = isStepComplete(current)

  return (
    <div className="min-h-screen flex items-center justify-center -m-6">
      <div className="w-full max-w-lg p-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold mb-2">Set up your workspace</h1>
          <p className="text-muted-foreground text-sm">Step {step + 1} of {STEPS.length}</p>
          <Progress value={progress} className="mt-3 h-1.5" />
        </div>

        {/* Question */}
        <div className="animate-fade-in space-y-4">
          <div>
            <label className="block text-lg font-medium mb-1">{current.question}</label>
            {current.hint && <p className="text-muted-foreground text-sm">{current.hint}</p>}
          </div>

          {/* Input */}
          {current.type === 'input' && (
            <Input
              key={current.key}
              value={freeText[current.key] || ''}
              onChange={e => setFreeText(prev => ({ ...prev, [current.key]: e.target.value }))}
              onBlur={() => {
                if ((current as InputStep).normalize && freeText[current.key]) {
                  setFreeText(prev => ({ ...prev, [current.key]: toTitleCase(prev[current.key]) }))
                }
              }}
              placeholder={(current as InputStep).placeholder}
              className="bg-surface border-border"
              onKeyDown={e => { if (e.key === 'Enter' && complete) { e.preventDefault(); handleNext() } }}
              autoFocus
            />
          )}

          {/* Textarea */}
          {current.type === 'textarea' && (
            <Textarea
              key={current.key}
              value={freeText[current.key] || ''}
              onChange={e => setFreeText(prev => ({ ...prev, [current.key]: e.target.value }))}
              placeholder={(current as TextareaStep).placeholder}
              className="bg-surface border-border"
              rows={3}
              autoFocus
            />
          )}

          {/* Chips (single or multi select) */}
          {current.type === 'chips' && (
            <>
              <div className="flex flex-wrap gap-2">
                {(current as ChipsStep).options.map(opt => (
                  <Chip
                    key={opt}
                    label={opt}
                    active={chips.includes(opt)}
                    onClick={() => toggleChip(current.key, opt, (current as ChipsStep).multi)}
                  />
                ))}
              </div>
              {(current as ChipsStep).extraPlaceholder && (
                <Input
                  value={freeText[current.key] || ''}
                  onChange={e => setFreeText(prev => ({ ...prev, [current.key]: e.target.value }))}
                  placeholder={(current as ChipsStep).extraPlaceholder}
                  className="bg-surface border-border text-sm"
                  onKeyDown={e => { if (e.key === 'Enter' && complete) { e.preventDefault(); handleNext() } }}
                />
              )}
            </>
          )}

          {/* Radio (single select preset + optional custom) */}
          {current.type === 'radio' && (
            <>
              <div className="flex flex-wrap gap-2">
                {(current as RadioStep).options.map(opt => (
                  <Chip
                    key={opt}
                    label={opt}
                    active={chips.includes(opt)}
                    onClick={() => toggleChip(current.key, opt, false)}
                  />
                ))}
              </div>
              {(current as RadioStep).customPlaceholder && (
                <Input
                  value={freeText[current.key] || ''}
                  onChange={e => {
                    setFreeText(prev => ({ ...prev, [current.key]: e.target.value }))
                    // Typing in custom clears chip selection
                    if (e.target.value) setChipSel(prev => ({ ...prev, [current.key]: [] }))
                  }}
                  placeholder={(current as RadioStep).customPlaceholder}
                  className="bg-surface border-border text-sm"
                  onKeyDown={e => { if (e.key === 'Enter' && complete) { e.preventDefault(); handleNext() } }}
                />
              )}
            </>
          )}
        </div>

        {/* Nav */}
        <div className="flex justify-between mt-8">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            Back
          </Button>
          <Button onClick={handleNext} disabled={!complete}>
            {step === STEPS.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </div>

      </div>
    </div>
  )
}
