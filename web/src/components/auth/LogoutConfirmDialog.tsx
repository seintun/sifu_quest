'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

type LogoutConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSignOut: () => void
  isSigningOut?: boolean
  /** Display name or email shown in the dialog so Google users know which account they're leaving */
  displayName?: string | null
}

export function LogoutConfirmDialog({
  open,
  onOpenChange,
  onSignOut,
  isSigningOut = false,
  displayName,
}: LogoutConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={isSigningOut ? undefined : onOpenChange}>
      <DialogContent data-testid="logout-confirm-dialog" className="max-w-sm w-full mx-4 sm:mx-auto">
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <LogOut className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            Sign out of Sifu Quest?
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {displayName ? (
              <>
                You&apos;re signed in as{' '}
                <span className="text-foreground font-medium">{displayName}</span>. You can
                always sign back in.
              </>
            ) : (
              "You can always sign back in with your Google account."
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            data-testid="logout-cancel-button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={isSigningOut}
          >
            Cancel
          </Button>
          <Button
            data-testid="logout-confirm-button"
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={onSignOut}
            disabled={isSigningOut}
            aria-label="Confirm sign out"
          >
            {isSigningOut ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Signing out…
              </span>
            ) : (
              'Sign Out'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
