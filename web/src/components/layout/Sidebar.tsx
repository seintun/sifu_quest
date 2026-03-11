'use client'

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useAuthStatus } from '@/context/AuthStatusContext'
import { performSignOut } from '@/lib/auth-signout'
import { startGuestGoogleUpgrade } from '@/lib/guest-upgrade'
import { GuestLogoutDialog } from '@/components/auth/GuestLogoutDialog'
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog'
import {
    BookOpen,
    Briefcase,
    Calendar,
    ClipboardList,
    Code2,
    LayoutDashboard,
    LogOut,
    Menu,
    MessageCircle,
    Network,
    Settings,
    X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { href: '/',              label: 'Dashboard',      icon: LayoutDashboard, color: 'streak' },
  { href: '/plan',          label: 'Game Plan',      icon: ClipboardList,   color: 'plan' },
  { href: '/calendar',      label: 'Calendar',       icon: Calendar,        color: 'streak' },
  { href: '/dsa',           label: 'DSA Tracker',    icon: Code2,           color: 'dsa' },
  { href: '/system-design', label: 'System Design',  icon: Network,         color: 'design' },
  { href: '/jobs',          label: 'Job Search',     icon: Briefcase,       color: 'jobs' },
  { href: '/memory',        label: 'Memory',         icon: BookOpen,        color: 'streak' },
  { href: '/coach',         label: 'Coach Chat',     icon: MessageCircle,   color: 'coach' },
  { href: '/settings',      label: 'Settings',       icon: Settings,        color: 'streak' },
] as const

const COLOR_CLASSES: Record<string, { active: string; border: string }> = {
  dsa:    { active: 'text-dsa bg-dsa/10',       border: 'border-l-dsa' },
  jobs:   { active: 'text-jobs bg-jobs/10',      border: 'border-l-jobs' },
  design: { active: 'text-design bg-design/10',  border: 'border-l-design' },
  coach:  { active: 'text-coach bg-coach/10',    border: 'border-l-coach' },
  streak: { active: 'text-streak bg-streak/10',  border: 'border-l-streak' },
  plan:   { active: 'text-plan bg-plan/10',      border: 'border-l-plan' },
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href
        const colors = COLOR_CLASSES[item.color]
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              isActive
                ? `border-l-2 ${colors.border} ${colors.active} font-medium`
                : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

type LogoutFooterProps = {
  /** When true the sign-out click queues the action instead of opening dialogs immediately 
   *  (used by mobile sidebar so the Sheet can close first) */
  deferred?: boolean
  onDeferredLogout?: () => void
}

function LogoutFooter({ deferred, onDeferredLogout }: LogoutFooterProps) {
  const { isGuest, accountStatus } = useAuthStatus()

  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOutClick = () => {
    if (deferred && onDeferredLogout) {
      onDeferredLogout()
      return
    }
    if (isGuest) {
      setGuestDialogOpen(true)
    } else {
      setGoogleDialogOpen(true)
    }
  }

  const handleGuestUpgrade = async () => {
    setIsUpgrading(true)
    const result = await startGuestGoogleUpgrade(window.location.origin)
    if (!result.ok) {
      // Upgrade failed — fall back to just closing the dialog
      setIsUpgrading(false)
      setGuestDialogOpen(false)
    }
    // On success the page redirects, no need to reset state
  }

  const handleGuestSignOut = async () => {
    setIsSigningOut(true)
    await performSignOut()
  }

  const handleGoogleSignOut = async () => {
    setIsSigningOut(true)
    await performSignOut()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSignOutClick}
        data-testid="sidebar-signout-button"
        className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-danger hover:bg-danger/5 transition-colors"
        aria-label="Sign out of your account"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>

      {/* Only render dialogs when not deferred — in MobileSidebar the dialogs
          are mounted outside the Sheet to avoid duplicate instances. */}
      {!deferred && (
        <>
          <GuestLogoutDialog
            open={guestDialogOpen}
            onOpenChange={setGuestDialogOpen}
            onUpgrade={handleGuestUpgrade}
            onSignOut={handleGuestSignOut}
            isUpgrading={isUpgrading}
            isSigningOut={isSigningOut}
          />
          <LogoutConfirmDialog
            open={googleDialogOpen}
            onOpenChange={setGoogleDialogOpen}
            onSignOut={handleGoogleSignOut}
            isSigningOut={isSigningOut}
            displayName={accountStatus?.displayName ?? undefined}
          />
        </>
      )}
    </>
  )
}


export function Sidebar() {
  return (
    <aside data-testid="desktop-sidebar" className="hidden md:flex w-56 flex-col fixed inset-y-0 left-0 bg-surface border-r border-border z-30">
      <div className="p-4 border-b border-border">
        <h1 className="font-display text-lg font-bold text-foreground">
          Sifu Quest
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Personal Dashboard</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks />
      </div>
      <div className="p-3 border-t border-border">
        <LogoutFooter />
      </div>
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const { isGuest } = useAuthStatus()

  // Pending logout intent — set when user taps Sign Out inside the Sheet.
  // We close the Sheet first, then open the appropriate dialog once it's gone.
  const [pendingLogout, setPendingLogout] = useState(false)
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // After the Sheet finishes closing, open the correct dialog
  useEffect(() => {
    if (!open && pendingLogout) {
      setPendingLogout(false)
      if (isGuest) {
        setGuestDialogOpen(true)
      } else {
        setGoogleDialogOpen(true)
      }
    }
  }, [open, pendingLogout, isGuest])

  const { accountStatus } = useAuthStatus()

  const handleGuestUpgrade = async () => {
    setIsUpgrading(true)
    const result = await startGuestGoogleUpgrade(window.location.origin)
    if (!result.ok) {
      setIsUpgrading(false)
      setGuestDialogOpen(false)
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    await performSignOut()
  }

  return (
    <div data-testid="mobile-sidebar-header" className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border h-12">
      <div className="flex h-full items-center justify-between px-3">
        <h1 className="font-display text-base font-bold text-foreground">
          Sifu Quest
        </h1>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            data-testid="mobile-sidebar-trigger"
            render={<button className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Open navigation menu" />}
          >
            {open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          </SheetTrigger>
          <SheetContent data-testid="mobile-sidebar-content" side="left" className="w-56 bg-surface border-r border-border p-0 flex flex-col">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="p-4 border-b border-border">
              <h2 className="font-display text-lg font-bold">Sifu Quest</h2>
            </div>
            <div className="flex-1 p-3 overflow-y-auto">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="p-3 border-t border-border">
              {/* Deferred so Sheet closes before the dialog mounts */}
              <LogoutFooter
                deferred
                onDeferredLogout={() => {
                  setOpen(false)
                  setPendingLogout(true)
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Dialogs live outside the Sheet so they render after it closes */}
      <GuestLogoutDialog
        open={guestDialogOpen}
        onOpenChange={setGuestDialogOpen}
        onUpgrade={handleGuestUpgrade}
        onSignOut={handleSignOut}
        isUpgrading={isUpgrading}
        isSigningOut={isSigningOut}
      />
      <LogoutConfirmDialog
        open={googleDialogOpen}
        onOpenChange={setGoogleDialogOpen}
        onSignOut={handleSignOut}
        isSigningOut={isSigningOut}
        displayName={accountStatus?.displayName ?? undefined}
      />
    </div>
  )
}
