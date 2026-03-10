'use client'

import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type ApiKeyStatus = {
  hasPersonalKey: boolean
  trial: {
    active: boolean
    code: 'trial_limit_reached' | 'trial_expired' | null
    remainingMessages: number
    expiresAt: string | null
  }
}

type RuntimeConfigStatus = {
  required: Array<{ key: string; configured: boolean }>
  optional: Array<{ key: string; configured: boolean }>
  missingRequiredKeys: string[]
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [apiKey, setApiKey] = useState('')
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null)
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeConfigStatus | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  const refreshStatus = async () => {
    const [keyStatusRes, runtimeStatusRes] = await Promise.all([
      fetch('/api/auth/apikey'),
      fetch('/api/runtime-config-status'),
    ])

    if (keyStatusRes.ok) {
      const data = await keyStatusRes.json()
      setApiKeyStatus(data)
    }

    if (runtimeStatusRes.ok) {
      const data = await runtimeStatusRes.json()
      setRuntimeStatus(data)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin')
      return
    }

    if (status === 'authenticated') {
      void refreshStatus()
    }
  }, [status, router])

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage({ text: '', type: '' })

    try {
      const res = await fetch('/api/auth/apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ text: 'Personal API key saved. Unlimited usage unlocked.', type: 'success' })
        setApiKey('')
        await refreshStatus()
      } else {
        setMessage({ text: data.error || 'Failed to save key.', type: 'error' })
      }
    } catch {
      setMessage({ text: 'An unexpected error occurred.', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteKey = async () => {
    setIsSaving(true)
    setMessage({ text: '', type: '' })

    try {
      const res = await fetch('/api/auth/apikey', {
        method: 'DELETE',
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ text: 'Personal API key removed. Trial limits now apply.', type: 'success' })
        await refreshStatus()
      } else {
        setMessage({ text: data.error || 'Failed to delete key.', type: 'error' })
      }
    } catch {
      setMessage({ text: 'An unexpected error occurred.', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you absolutely sure? This will delete all your memory context, logs, and chats. This cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (res.ok) {
        await signOut({ callbackUrl: '/' })
      } else {
        const data = await res.json()
        setMessage({ text: data.error || 'Failed to delete account.', type: 'error' })
        setIsDeleting(false)
      }
    } catch {
      setMessage({ text: 'An unexpected error occurred.', type: 'error' })
      setIsDeleting(false)
    }
  }

  if (status === 'loading') return <div className="p-8">Loading...</div>
  if (!session) return null

  const isGuest = session.user?.email?.endsWith('@anonymous.local')
  const trialStatus = apiKeyStatus?.trial

  const handleLinkGoogle = async () => {
    const { createClientBrowser } = await import('@/lib/supabase-browser')
    const supabase = createClientBrowser()

    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/link-google/callback`
      }
    })

    if (error) {
      setMessage({ text: `Failed to link account: ${error.message}`, type: 'error' })
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">Account Settings</h1>

      {message.text && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-2">Usage & Entitlements</h2>
        {apiKeyStatus?.hasPersonalKey ? (
          <p className="text-sm text-green-700">Unlimited mode active with your encrypted personal Anthropic API key.</p>
        ) : (
          <div className="text-sm text-slate-700 space-y-1">
            <p>Trial mode active with the server guest key.</p>
            <p>Messages remaining: <strong>{trialStatus?.remainingMessages ?? 0}</strong> / 5</p>
            {trialStatus?.expiresAt && (
              <p>Trial expires at: <strong>{new Date(trialStatus.expiresAt).toLocaleString()}</strong></p>
            )}
            {trialStatus?.code === 'trial_limit_reached' && <p className="text-red-700">Trial message limit reached. Add your own key to continue.</p>}
            {trialStatus?.code === 'trial_expired' && <p className="text-red-700">Trial window expired. Add your own key to continue.</p>}
          </div>
        )}
      </section>

      {isGuest && (
        <section className="bg-streak/10 p-6 rounded-lg shadow-sm border border-streak/30">
          <h2 className="text-xl font-semibold text-streak mb-2">Upgrade to Full Account</h2>
          <p className="text-slate-600 mb-4 text-sm">
            You are currently using a temporary Guest session. Link a Google account to permanently save your chat history, memory files, and progress metrics.
          </p>
          <button
            onClick={handleLinkGoogle}
            className="bg-streak hover:opacity-90 text-white px-4 py-2 rounded-md font-medium transition-opacity"
          >
            Link Google Account
          </button>
        </section>
      )}

      <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-2">Personal Anthropic API Key</h2>
        <p className="text-slate-600 mb-4 text-sm">
          This is your personal key, encrypted at rest in Supabase (`api_key_enc`). It unlocks unlimited usage for your account.
        </p>

        <form onSubmit={handleSaveKey} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700 mb-1">
              API Key (sk-ant-...)
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Enter your personal key..."
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Personal Key'}
            </button>
            <button
              type="button"
              onClick={handleDeleteKey}
              disabled={isSaving || !apiKeyStatus?.hasPersonalKey}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-md font-medium disabled:opacity-50 transition-colors"
            >
              Remove Key
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-2">Infra Environment Keys</h2>
        <p className="text-slate-600 mb-4 text-sm">
          Infrastructure keys are managed only in `.env.local` (local) or Vercel environment variables (deploy). This page only shows configured/missing status by key name.
        </p>
        <div className="space-y-3 text-sm">
          {runtimeStatus?.required.map((item) => (
            <div key={item.key} className="flex justify-between">
              <span className="font-mono">{item.key}</span>
              <span className={item.configured ? 'text-green-700' : 'text-red-700'}>
                {item.configured ? 'Configured' : 'Missing'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-6 rounded-lg shadow-sm border border-red-200 mt-8">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Danger Zone</h2>
        <p className="text-slate-600 mb-4 text-sm">
          Permanently delete your account and all associated data (memories, chat history, progress logs). This action is irreversible.
        </p>

        <button
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-md font-medium disabled:opacity-50 transition-colors"
        >
          {isDeleting ? 'Deleting...' : 'Delete Account'}
        </button>
      </section>
    </div>
  )
}

