'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'

const STEPS = [
  { key: 'name', question: "What's your name?", placeholder: 'Your name', type: 'input' },
  { key: 'situation', question: "What's your current situation?", placeholder: 'e.g., Job searching, employed but looking, student...', type: 'input' },
  { key: 'targetRoles', question: "What are your target roles?", placeholder: 'e.g., Senior SWE, Full-Stack Engineer, Backend Developer', type: 'input' },
  { key: 'language', question: "What's your primary programming / DSA interview language?", placeholder: 'e.g., Python, JavaScript, TypeScript', type: 'input' },
  { key: 'targetCompanies', question: 'Target companies or tiers?', placeholder: 'e.g., FAANG, mid-stage startups, specific companies...', type: 'input' },
  { key: 'timeline', question: "What's your timeline?", placeholder: 'e.g., 2-3 months, starting immediately', type: 'input' },
  { key: 'strengths', question: 'What are your 2-3 strongest areas?', placeholder: 'e.g., React, API design, system architecture (comma-separated)', type: 'textarea' },
  { key: 'weaknesses', question: 'What are 1-2 areas you need to work on?', placeholder: 'e.g., DSA, system design, behavioral interviews (comma-separated)', type: 'textarea' },
] as const

type StepKey = typeof STEPS[number]['key']

export default function OnboardingPage() {
  const router = useRouter()

  // API key phase — shown first if key isn't configured
  const [needsApiKey, setNeedsApiKey] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [apiKeyError, setApiKeyError] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  // Profile phase
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<StepKey, string>>({
    name: '',
    situation: '',
    targetRoles: '',
    language: '',
    targetCompanies: '',
    timeline: '',
    strengths: '',
    weaknesses: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(data => setNeedsApiKey(!data.hasApiKey))
      .catch(() => setNeedsApiKey(false))
  }, [])

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
      if (!res.ok) {
        setApiKeyError(data.error || 'Failed to save API key')
        return
      }
      setNeedsApiKey(false)
    } finally {
      setSavingKey(false)
    }
  }

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      setLoading(true)
      try {
        const res = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(answers),
        })
        if (res.ok) {
          router.push('/')
        }
      } finally {
        setLoading(false)
      }
    }
  }

  // Still checking API key status
  if (needsApiKey === null) {
    return (
      <div className="min-h-screen flex items-center justify-center -m-6">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  // API key screen
  if (needsApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center -m-6">
        <div className="w-full max-w-lg p-8">
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold mb-2">Set up your workspace</h1>
            <p className="text-muted-foreground text-sm">Step 1 of 2 — Connect your API key</p>
            <Progress value={50} className="mt-3 h-1.5" />
          </div>

          <div className="animate-fade-in">
            <label className="block text-lg font-medium mb-2">
              Enter your Anthropic API key
            </label>
            <p className="text-muted-foreground text-sm mb-4">
              Get yours at{' '}
              <span className="text-foreground font-mono text-xs">console.anthropic.com</span>
              . It&apos;s saved locally in{' '}
              <span className="font-mono text-xs">.env.local</span> and never leaves your machine.
            </p>
            <Input
              type="password"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setApiKeyError('') }}
              placeholder="sk-ant-..."
              className="bg-surface border-border font-mono"
              onKeyDown={e => e.key === 'Enter' && apiKey.startsWith('sk-ant-') && handleSaveApiKey()}
              autoFocus
            />
            {apiKeyError && (
              <p className="text-destructive text-sm mt-2">{apiKeyError}</p>
            )}
          </div>

          <div className="flex justify-end mt-8">
            <Button
              onClick={handleSaveApiKey}
              disabled={!apiKey.startsWith('sk-ant-') || savingKey}
            >
              {savingKey ? 'Verifying...' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Profile steps
  const current = STEPS[step]
  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen flex items-center justify-center -m-6">
      <div className="w-full max-w-lg p-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold mb-2">Set up your workspace</h1>
          <p className="text-muted-foreground text-sm">
            Step {step + 1} of {STEPS.length}
          </p>
          <Progress value={progress} className="mt-3 h-1.5" />
        </div>

        <div className="animate-fade-in">
          <label className="block text-lg font-medium mb-4">{current.question}</label>
          {current.type === 'textarea' ? (
            <Textarea
              key={current.key}
              value={answers[current.key]}
              onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
              placeholder={current.placeholder}
              className="bg-surface border-border"
              rows={3}
              autoFocus
            />
          ) : (
            <Input
              key={current.key}
              value={answers[current.key]}
              onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
              placeholder={current.placeholder}
              className="bg-surface border-border"
              onKeyDown={(e) => { if (e.key === 'Enter' && answers[current.key]) { e.preventDefault(); handleNext() } }}
              autoFocus
            />
          )}
        </div>

        <div className="flex justify-between mt-8">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!answers[current.key] || loading}
          >
            {loading ? 'Saving...' : step === STEPS.length - 1 ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
