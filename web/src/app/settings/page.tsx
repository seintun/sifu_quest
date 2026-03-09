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

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">Account Settings</h1>
      
      {message.text && (
        <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
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
