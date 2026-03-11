'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
      {/*
        On iPhone SE (375×667) with browser chrome, dead-center (top-1/2) positioning
        pushes the dialog too high and leaves it feeling clipped.
        We anchor toward the top on mobile (top-[8vh]) so the content sits
        naturally in the visible area, then fall back to standard centering on sm+.
        max-h-[84svh] + overflow-y-auto prevents content from ever being cut off.
      */}
      <DialogContent
        className="
          left-1/2 -translate-x-1/2
          top-[8vh] translate-y-0
          sm:top-1/2 sm:-translate-y-1/2
          w-[calc(100%-2rem)] max-w-sm
          max-h-[84svh] overflow-y-auto
        "
      >
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-danger shrink-0" aria-hidden="true" />
            End Guest Session?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Your memories and progress will be{' '}
            <span className="text-foreground font-medium">permanently deleted</span> on sign-out.
          </DialogDescription>
        </DialogHeader>

        {/* Upgrade callout */}
        <div className="rounded-lg border border-streak/30 bg-streak/5 px-3 py-2.5 space-y-0.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-streak">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Save your progress
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Link Google to keep your memories and sessions permanently — free.
          </p>
        </div>

        {/*
          Plain div footer — avoids DialogFooter's `flex-col-reverse` which would
          swap the CTA and the "sign out anyway" link on mobile.
        */}
        <div className="-mx-4 -mb-4 flex flex-col gap-2 rounded-b-xl border-t border-border/60 bg-muted/50 px-4 py-4">
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

          <button
            type="button"
            onClick={onSignOut}
            disabled={isBusy}
            className="text-sm text-danger/80 hover:text-danger underline-offset-2 hover:underline transition-colors py-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Sign out anyway and delete guest session"
          >
            {isSigningOut ? 'Signing out…' : 'Sign out anyway'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
