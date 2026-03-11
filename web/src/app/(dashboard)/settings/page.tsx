'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { canSaveAnthropicApiKey, shouldShowRemoveApiKey } from '@/lib/account-settings-ui'
import { startGuestGoogleUpgrade } from '@/lib/guest-upgrade'
import { getOnboardingPrefillName } from '@/lib/onboarding-name'
import { validateFullName } from '@/lib/profile-name'
import { performSignOut } from '@/lib/auth-signout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GuestLogoutDialog } from '@/components/auth/GuestLogoutDialog'
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog'
import { KeyRound, Loader2, ShieldAlert, UserRound, LogOut } from 'lucide-react'

type AccountStatus = {
  userId: string
  isGuest: boolean
  isLinked: boolean
  displayName: string | null
  hasApiKey: boolean
  hasAnthropicApiKey?: boolean
  defaultProvider?: 'openrouter' | 'anthropic'
  defaultModel?: string | null
  prefillName: string | null
  avatarUrl: string | null
}

type UsageTotals = {
  userTurns: number
  assistantTurns: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCostMicrousd: number
}

type AccountUsage = {
  lifetime: UsageTotals
  trailing30Days: UsageTotals
  providerBreakdown: Array<UsageTotals & { provider: string }>
  modelBreakdown: Array<UsageTotals & { provider: string; model: string }>
}

type FlashMessage = { text: string; type: 'success' | 'error' } | null

type OnboardingStateResponse = {
  onboarding: {
    status: 'not_started' | 'in_progress' | 'core_complete' | 'enriched_complete'
  }
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading settings...</div>}>
      <SettingsPageContent />
    </Suspense>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border-border bg-surface/80 backdrop-blur-sm animate-pulse">
        <CardHeader>
          <div className="h-5 w-32 bg-muted rounded mb-2" />
          <div className="h-4 w-64 bg-muted/60 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-10 w-full bg-muted/40 rounded" />
          <div className="h-9 w-32 bg-muted rounded mt-2" />
        </CardContent>
      </Card>
      <Card className="border-border bg-surface/80 backdrop-blur-sm animate-pulse">
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded mb-2" />
          <div className="h-4 w-72 bg-muted/60 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-10 w-full bg-muted/40 rounded" />
          <div className="h-9 w-32 bg-muted rounded mt-2" />
        </CardContent>
      </Card>
      <Card className="border-border bg-surface/80 backdrop-blur-sm animate-pulse">
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded mb-2" />
          <div className="h-4 w-64 bg-muted/60 rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="h-32 bg-muted/40 rounded" />
            <div className="h-32 bg-muted/40 rounded" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [apiKey, setApiKey] = useState('')
  const [apiKeyFieldError, setApiKeyFieldError] = useState('')
  const [fullName, setFullName] = useState('')

  const [isSavingName, setIsSavingName] = useState(false)
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [isRemovingKey, setIsRemovingKey] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const [guestLogoutOpen, setGuestLogoutOpen] = useState(false)
  const [googleLogoutOpen, setGoogleLogoutOpen] = useState(false)

  const [message, setMessage] = useState<FlashMessage>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const isDeletePhraseValid = deleteConfirmText === 'DELETE'

  const { data: accountData, mutate: mutateAccountStatus, isLoading: isAccountStatusLoading, error: accountSwrError } = useSWR('/api/account/status', fetcher)
  const { data: usageData, mutate: mutateUsage, isLoading: isUsageLoading } = useSWR('/api/account/usage', fetcher)
  const { data: onboardingData, mutate: mutateOnboarding } = useSWR('/api/onboarding/status?kick=true', fetcher)

  const accountStatus = accountData?.account as AccountStatus | undefined
  const accountStatusError = accountData?.error || accountSwrError?.message || ''
  const isAccountStatusInitialized = accountData !== undefined || accountSwrError !== undefined || (!isAccountStatusLoading && accountStatusError !== '')

  const usage = usageData as AccountUsage | undefined
  const usageError = usageData?.message || usageData?.error || ''

  const onboardingState = onboardingData as OnboardingStateResponse | undefined

  useEffect(() => {
    if (accountData?.error && String(accountData.error).toLowerCase().includes('unauthorized')) {
      router.push('/api/auth/signin')
    } else if (accountStatus && !fullName) {
      setFullName(getOnboardingPrefillName(accountStatus.displayName, accountStatus.prefillName))
    }
  }, [accountData, accountStatus, fullName, router])

  useEffect(() => {
    if (searchParams.get('success') === 'linked') {
      setMessage({ text: 'Google account linked. Your guest profile has been upgraded without losing any data.', type: 'success' })
      mutateAccountStatus()
      mutateOnboarding()
    } else if (searchParams.get('error') === 'link_failed') {
      setMessage({ text: 'Failed to link your Google account. Please try again.', type: 'error' })
    }
  }, [searchParams, mutateAccountStatus, mutateOnboarding])

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const validation = validateFullName(fullName)
    if (!validation.ok) {
      setMessage({ text: validation.error, type: 'error' })
      return
    }

    setIsSavingName(true)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: validation.value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to update full name.', type: 'error' })
        return
      }

      setFullName(data.account?.displayName || validation.value)
      mutateAccountStatus()
      setMessage({ text: 'Full name updated successfully.', type: 'success' })
    } catch {
      setMessage({ text: 'An unexpected error occurred while updating your full name.', type: 'error' })
    } finally {
      setIsSavingName(false)
    }
  }

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingKey(true)
    setMessage(null)
    setApiKeyFieldError('')

    try {
      const res = await fetch('/api/auth/apikey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ text: 'API key saved successfully.', type: 'success' })
        setApiKey('')
        mutateAccountStatus()
      } else {
        if (data.code === 'apikey_config_error') {
          setApiKeyFieldError('Secure key storage is temporarily unavailable. Your key was not saved. Please try again later.')
        } else {
          setApiKeyFieldError(data.error || 'Failed to save API key.')
        }
      }
    } catch {
      setApiKeyFieldError('An unexpected error occurred while saving API key.')
    } finally {
      setIsSavingKey(false)
    }
  }

  const handleRemoveKey = async () => {
    setIsRemovingKey(true)
    setMessage(null)

    try {
      const res = await fetch('/api/auth/apikey', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to remove API key.', type: 'error' })
        return
      }
      setMessage({ text: 'API key removed.', type: 'success' })
      mutateAccountStatus()
    } catch {
      setMessage({ text: 'An unexpected error occurred while removing API key.', type: 'error' })
    } finally {
      setIsRemovingKey(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!isDeletePhraseValid) return

    setIsDeleting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (res.ok) {
        await performSignOut()
      } else {
        const data = await res.json().catch(() => ({}))
        setMessage({ text: data.error || 'Failed to delete account.', type: 'error' })
        setDeleteDialogOpen(false)
      }
    } catch {
      setMessage({ text: 'An unexpected error occurred while deleting your account.', type: 'error' })
      setDeleteDialogOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleLinkGoogle = async () => {
    const result = await startGuestGoogleUpgrade(window.location.origin)
    if (!result.ok) {
      setMessage({ text: `Failed to link account: ${result.error}`, type: 'error' })
    }
  }

  const handleGuestUpgradeFromDialog = async () => {
    setIsUpgrading(true)
    const result = await startGuestGoogleUpgrade(window.location.origin)
    if (!result.ok) {
      setMessage({ text: `Failed to link account: ${result.error}`, type: 'error' })
      setIsUpgrading(false)
      setGuestLogoutOpen(false)
    }
    // On success the page redirects via OAuth
  }

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    await performSignOut()
  }

  const handleSignOutClick = () => {
    if (isGuest) {
      setGuestLogoutOpen(true)
    } else {
      setGoogleLogoutOpen(true)
    }
  }

  const isGuest = Boolean(accountStatus?.isGuest)

  const normalizedCurrentName = useMemo(() => (accountStatus?.displayName ?? '').trim(), [accountStatus?.displayName])
  const normalizedInputName = useMemo(() => fullName.trim().replace(/\s+/g, ' '), [fullName])
  const canSaveApiKey = useMemo(() => canSaveAnthropicApiKey(apiKey), [apiKey])
  const isNameDirty = normalizedInputName !== normalizedCurrentName
  const hasAnthropicApiKey = Boolean(accountStatus?.hasAnthropicApiKey ?? accountStatus?.hasApiKey)

  const formatMicrousd = useCallback((microusd: number) => `$${(microusd / 1_000_000).toFixed(4)}`, [])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage profile info, API access, and account safety controls.</p>
      </div>

      {!isAccountStatusInitialized ? (
        <SettingsSkeleton />
      ) : (
        <>
          {message && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-danger/30 bg-danger/10 text-danger'
              }`}
            >
              {message.text}
            </div>
          )}

      {/* ── Session card ── */}
      {isAccountStatusInitialized && (
        <Card
          className={
            isGuest
              ? 'border-streak/30 bg-streak/5 shadow-glow-streak'
              : 'border-border bg-surface/80 backdrop-blur-sm'
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-streak" />
              {isGuest ? 'Guest Session' : 'Your Account'}
            </CardTitle>
            <CardDescription>
              {isGuest
                ? 'You\'re browsing as a guest. Your progress is saved temporarily — it will be lost if you sign out without linking Google.'
                : accountStatus?.displayName
                  ? `Signed in as ${accountStatus.displayName}.`
                  : 'Signed in with Google.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row flex-wrap gap-2">
            {isGuest && (
              <Button onClick={handleLinkGoogle} disabled={isAccountStatusLoading}>
                Link Google Account
              </Button>
            )}
            <Button
              variant="outline"
              className="flex items-center gap-2 text-danger border-danger/30 hover:bg-danger/5 hover:text-danger"
              onClick={handleSignOutClick}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>


          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-surface/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-plan" />
            Profile
          </CardTitle>
          <CardDescription>Set the name used across your workspace and coach context.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveName} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-sm font-medium text-foreground">
                Full Name
              </label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Ada Lovelace"
                maxLength={80}
                disabled={isSavingName}
                className="bg-elevated/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSavingName || !isNameDirty}>
                {isSavingName ? 'Saving...' : 'Save Full Name'}
              </Button>
              <span className="text-xs text-muted-foreground">This also updates your `profile.md` name line.</span>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-coach" />
            Anthropic API Key
          </CardTitle>
          <CardDescription>
            You only provide your Anthropic key (`sk-ant-...`). We encrypt it with AES-256-CBC before storage, never store or log plaintext, and use it only to call Claude on your behalf.
            OpenRouter free models use an app-managed server key (`OPENROUTER_API_KEY`), not this field.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveKey} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="apiKey" className="text-sm font-medium text-foreground">
                API Key (sk-ant-...)
              </label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  if (apiKeyFieldError) {
                    setApiKeyFieldError('')
                  }
                }}
                placeholder="Paste your Anthropic key"
                className="bg-elevated/50"
                required
                disabled={isSavingKey}
              />
              {apiKeyFieldError && (
                <p className="text-xs text-danger" role="alert">
                  {apiKeyFieldError}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={!canSaveApiKey || isSavingKey || isRemovingKey}>
                {isSavingKey ? 'Saving...' : 'Save API Key'}
              </Button>
              {shouldShowRemoveApiKey(hasAnthropicApiKey) && (
                <Button type="button" variant="outline" onClick={handleRemoveKey} disabled={isSavingKey || isRemovingKey}>
                  {isRemovingKey ? 'Removing...' : 'Remove Key'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border bg-surface/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Chat Usage Metrics</CardTitle>
          <CardDescription>
            Session and account usage telemetry aggregated from your chat history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isUsageLoading ? (
            <p className="text-muted-foreground">Loading usage metrics...</p>
          ) : usageError ? (
            <p className="text-danger">{usageError}</p>
          ) : usage ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 bg-elevated/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Last 30 days</p>
                  <p className="mt-1">User turns: {usage.trailing30Days.userTurns}</p>
                  <p>Assistant turns: {usage.trailing30Days.assistantTurns}</p>
                  <p>Total tokens: {usage.trailing30Days.totalTokens}</p>
                  <p>Estimated cost: {formatMicrousd(usage.trailing30Days.estimatedCostMicrousd)}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-elevated/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Lifetime</p>
                  <p className="mt-1">User turns: {usage.lifetime.userTurns}</p>
                  <p>Assistant turns: {usage.lifetime.assistantTurns}</p>
                  <p>Total tokens: {usage.lifetime.totalTokens}</p>
                  <p>Estimated cost: {formatMicrousd(usage.lifetime.estimatedCostMicrousd)}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-elevated/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Provider breakdown</p>
                {usage.providerBreakdown.length === 0 ? (
                  <p className="text-muted-foreground">No provider usage yet.</p>
                ) : (
                  <div className="space-y-1">
                    {usage.providerBreakdown.map((provider) => (
                      <p key={provider.provider}>
                        {provider.provider}: {provider.assistantTurns} responses, {provider.totalTokens} tokens, {formatMicrousd(provider.estimatedCostMicrousd)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No usage metrics yet.</p>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => mutateUsage()} disabled={isUsageLoading}>
              {isUsageLoading ? 'Refreshing...' : 'Refresh Usage'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-danger/40 bg-danger/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-danger">
            <ShieldAlert className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action is irreversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <GuestLogoutDialog
        open={guestLogoutOpen}
        onOpenChange={setGuestLogoutOpen}
        onUpgrade={handleGuestUpgradeFromDialog}
        onSignOut={handleSignOut}
        isUpgrading={isUpgrading}
        isSigningOut={isLoggingOut}
      />
      <LogoutConfirmDialog
        open={googleLogoutOpen}
        onOpenChange={setGoogleLogoutOpen}
        onSignOut={handleSignOut}
        isSigningOut={isLoggingOut}
        displayName={accountStatus?.displayName ?? undefined}
      />
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open)
        if (!open) setDeleteConfirmText('')
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Account Deletion</DialogTitle>
            <DialogDescription>
              This will permanently remove your profile, memory files, chats, progress, and auth account.
              Type <code className="px-1 py-0.5 rounded bg-elevated text-foreground">DELETE</code> to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor="deleteConfirm" className="text-sm font-medium text-foreground">
              Type DELETE to continue
            </label>
            <Input
              id="deleteConfirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="bg-elevated/50"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={!isDeletePhraseValid || isDeleting}>
              {isDeleting ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
  )
}
