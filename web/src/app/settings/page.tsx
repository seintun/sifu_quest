'use client'

import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin')
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
        setMessage({ text: 'API Key saved successfully.', type: 'success' })
        setApiKey('') // Clear it from memory
      } else {
        setMessage({ text: data.error || 'Failed to save key.', type: 'error' })
      }
    } catch (err) {
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
    } catch (err) {
      setMessage({ text: 'An unexpected error occurred.', type: 'error' })
      setIsDeleting(false)
    }
  }

  if (status === 'loading') return <div className="p-8">Loading...</div>
  if (!session) return null

  // Check if this is an anonymous guest account (using our dummy local email format from NextAuth config)
  const isGuest = session.user?.email?.endsWith('@anonymous.local')

  const handleLinkGoogle = async () => {
    // We need to use the actual Supabase client here directly as NextAuth doesn't natively 
    // expose linkIdentity. We'll load it dynamically to keep the bundle small.
    const { createClient } = await import('@/lib/supabase')
    const supabase = await createClient()
    
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback/google`
      }
    })
    
    if (error) {
      setMessage({ text: `Failed to link account: ${error.message}`, type: 'error' })
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">Account Settings</h1>
      
      {message.text && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Guest Upgrade Section */}
      {isGuest && (
        <section className="bg-streak/10 p-6 rounded-lg shadow-sm border border-streak/30">
          <h2 className="text-xl font-semibold text-streak mb-2">Upgrade to Full Account</h2>
          <p className="text-slate-600 mb-4 text-sm">
            You are currently using a temporary Guest session. Link a Google account to permanently save your chat history, memory files, and progress metrics.
          </p>
          <button
            onClick={handleLinkGoogle}
            className="bg-streak hover:opacity-90 text-white px-4 py-2 rounded-md font-medium transition-opacity flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Link Google Account
          </button>
        </section>
      )}

      {/* API Key Section */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold mb-2">Anthropic API Key</h2>
        <p className="text-slate-600 mb-4 text-sm">
          Your API key is encrypted and stored securely. We only use it to communicate with Claude on your behalf.
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
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter new API key to update..."
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save API Key'}
          </button>
        </form>
      </section>

      {/* Danger Zone Section */}
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
