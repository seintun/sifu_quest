'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Sparkles } from 'lucide-react'

type GuestLogoutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpgrade: () => void
  onSignOut: () => void
  isUpgrading?: boolean
  isSigningOut?: boolean
}

export function GuestLogoutDialog({
  open,
  onOpenChange,
  onUpgrade,
  onSignOut,
  isUpgrading = false,
  isSigningOut = false,
}: GuestLogoutDialogProps) {
  const isBusy = isUpgrading || isSigningOut

  return (
    <Dialog open={open} onOpenChange={isBusy ? undefined : onOpenChange}>
      <DialogContent className="max-w-sm w-full mx-4 sm:mx-auto">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-danger shrink-0" aria-hidden="true" />
            End Guest Session?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Your temporary memories, coach sessions, and progress will be{' '}
            <span className="text-foreground font-medium">permanently deleted</span> when you
            sign out.
          </DialogDescription>
        </DialogHeader>

        {/* Upgrade callout — uses streak token to match existing guest-upgrade card */}
        <div className="rounded-lg border border-streak/30 bg-streak/5 px-4 py-3 space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-medium text-streak">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Save your progress before leaving
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Link your Google account to permanently keep all your memories, sessions, and
            progress — free forever.
          </p>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          {/* Primary: upgrade CTA */}
          <Button
            className="w-full"
            onClick={onUpgrade}
            disabled={isBusy}
            aria-label="Create account and link Google to save your progress"
          >
            {isUpgrading ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Connecting…
              </span>
            ) : (
              'Create Account & Link Google'
            )}
          </Button>

          {/* Secondary: destructive sign-out */}
          <button
            type="button"
            onClick={onSignOut}
            disabled={isBusy}
            className="text-sm text-danger/80 hover:text-danger underline-offset-2 hover:underline transition-colors py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Sign out anyway and delete guest session"
          >
            {isSigningOut ? 'Signing out…' : 'Sign out anyway'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
