'use client'

import { GuestLogoutDialog } from '@/components/auth/GuestLogoutDialog'
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useAuthStatus } from '@/context/AuthStatusContext'
import { performSignOut } from '@/lib/auth-signout'
import { BRAND_EMOJIS, BRAND_NAME, NAV_COPY } from '@/lib/brand'
import {
  selectMobilePrimaryNavItems,
  selectMobileSecondaryNavItems,
  selectSidebarNavItems,
  type DashboardNavItem,
} from '@/lib/dashboard-navigation'
import { startGuestGoogleUpgrade } from '@/lib/guest-upgrade'
import { cn } from '@/lib/utils'
import { ArrowRight, Home, LogOut, MessageCircle, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const COLOR_CLASSES: Record<string, { active: string; border: string }> = {
  dsa: { active: 'text-dsa bg-dsa/10', border: 'border-l-dsa' },
  jobs: { active: 'text-jobs bg-jobs/10', border: 'border-l-jobs' },
  design: { active: 'text-design bg-design/10', border: 'border-l-design' },
  coach: { active: 'text-coach bg-coach/10', border: 'border-l-coach' },
  streak: { active: 'text-streak bg-streak/10', border: 'border-l-streak' },
  plan: { active: 'text-plan bg-plan/10', border: 'border-l-plan' },
}

function NavLinks({
  items,
  onNavigate,
}: {
  items: DashboardNavItem[]
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const trackerIds = new Set<DashboardNavItem['id']>(['dsa', 'jobs', 'system-design', 'calendar'])
  const workspaceIds = new Set<DashboardNavItem['id']>(['memory', 'settings'])
  const firstTrackerIndex = items.findIndex((item) => trackerIds.has(item.id))
  const firstWorkspaceIndex = items.findIndex((item) => workspaceIds.has(item.id))

  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {items.map((item, index) => {
        const isActive = pathname === item.href
        const colors = COLOR_CLASSES[item.domain]
        const Icon = item.icon

        return (
          <div key={item.id}>
            {index === firstTrackerIndex && (
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                  Trackers
                </p>
              </div>
            )}
            {index === firstWorkspaceIndex && (
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                  Workspace
                </p>
              </div>
            )}
            <Link
              href={item.href}
              onClick={onNavigate}
              data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? `border-l-2 ${colors.border} ${colors.active} font-medium`
                  : 'text-muted-foreground hover:text-foreground hover:bg-elevated',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          </div>
        )
      })}
    </nav>
  )
}

type LogoutFooterProps = {
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
      return
    }
    setGoogleDialogOpen(true)
  }

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

      {!deferred && (
        <>
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
        </>
      )}
    </>
  )
}

function MobileCoachToggle({ onCoachRoute }: { onCoachRoute: boolean }) {
  const destination = onCoachRoute ? '/' : '/coach'
  const label = onCoachRoute ? NAV_COPY.toDojo : NAV_COPY.askSifu
  const helper = onCoachRoute ? 'Dashboard' : 'Live'
  const Icon = onCoachRoute ? Home : MessageCircle

  return (
    <Link
      href={destination}
      data-testid="mobile-coach-toggle"
      aria-label={label}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-full border border-coach/35 bg-coach/8 pl-2 pr-2.5 py-1',
        'text-coach hover:text-coach/90 hover:border-coach/55 hover:bg-coach/12 active:scale-[0.98]',
        'motion-safe:transition-all motion-safe:duration-200',
      )}
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coach/18">
        <Icon className="h-3.5 w-3.5 motion-safe:transition-transform motion-safe:duration-200 group-hover:scale-110 group-hover:rotate-6" />
      </span>
      <span className="text-xs font-medium leading-none">{label}</span>
      <span className="inline-flex items-center gap-1 pl-0.5 text-[10px] text-coach/75">
        <span className="h-1.5 w-1.5 rounded-full bg-coach/90 animate-pulse" aria-hidden="true" />
        {helper}
      </span>
      <ArrowRight className="h-3 w-3 opacity-80 motion-safe:transition-transform motion-safe:duration-200 group-hover:translate-x-0.5" />
    </Link>
  )
}

export function DesktopCoachFloatingCta() {
  const pathname = usePathname()
  const onCoachRoute = pathname.startsWith('/coach')
  const destination = '/coach'
  const title = NAV_COPY.askSifu
  const helper = 'Open Coach'
  const Icon = MessageCircle

  if (onCoachRoute) {
    return null
  }

  return (
    <Link
      href={destination}
      data-testid="desktop-coach-floating-cta"
      aria-label={title}
      className={cn(
        'group hidden md:flex fixed right-6 bottom-6 z-50 items-center gap-3 rounded-2xl border border-coach/35 px-4 py-3',
        'bg-gradient-to-r from-coach/20 via-coach/10 to-coach/5 backdrop-blur shadow-[0_10px_30px_rgb(14_165_233_/_0.22)]',
        'text-coach hover:border-coach/55 hover:shadow-[0_12px_34px_rgb(14_165_233_/_0.3)] active:scale-[0.99]',
        'motion-safe:transition-all motion-safe:duration-200',
      )}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-coach/20 ring-1 ring-coach/35">
        <Icon className="h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 group-hover:scale-110" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-[11px] text-coach/80">{helper}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 opacity-80 motion-safe:transition-transform motion-safe:duration-200 group-hover:translate-x-0.5" />
    </Link>
  )
}

export function Sidebar() {
  return (
    <aside
      data-testid="desktop-sidebar"
      className="hidden md:flex w-56 flex-col fixed inset-y-0 left-0 bg-surface border-r border-border z-30"
    >
      <div className="p-4 border-b border-border">
        <h1 className="font-display text-lg font-bold text-foreground">{BRAND_NAME}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{NAV_COPY.dashboardHint}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks items={selectSidebarNavItems()} />
      </div>
      <div className="p-3 border-t border-border">
        <LogoutFooter />
      </div>
    </aside>
  )
}

export function MobileSidebar() {
  const pathname = usePathname()
  const onCoachRoute = pathname.startsWith('/coach')

  return (
    <div
      data-testid="mobile-sidebar-header"
      className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border h-12"
    >
      <div className="flex h-full items-center justify-between px-3">
        <h1 className="font-display text-base font-bold text-foreground">{BRAND_NAME}</h1>
        <MobileCoachToggle onCoachRoute={onCoachRoute} />
      </div>
    </div>
  )
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const onCoachRoute = pathname.startsWith('/coach')
  const [open, setOpen] = useState(false)
  const { isGuest, accountStatus } = useAuthStatus()
  const [guestDialogOpen, setGuestDialogOpen] = useState(false)
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const openDeferredLogoutDialog = () => {
    if (isGuest) {
      setGuestDialogOpen(true)
    } else {
      setGoogleDialogOpen(true)
    }
  }

  const handleSheetOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
  }

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

  if (onCoachRoute) {
    return null
  }

  return (
    <>
      <div
        data-testid="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur"
      >
        <nav className="grid grid-cols-4 gap-1 px-2 py-1.5" aria-label="Mobile primary navigation">
          {selectMobilePrimaryNavItems().map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.id}
                href={item.href}
                data-testid={`mobile-primary-${item.id}`}
                className={cn(
                  'flex flex-col items-center justify-center rounded-md py-1 text-[11px] transition-colors',
                  isActive ? 'text-foreground bg-elevated' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label === 'Dashboard' ? 'Home' : item.label}
              </Link>
            )
          })}

          <Sheet open={open} onOpenChange={handleSheetOpenChange}>
            <SheetTrigger
              data-testid="mobile-sidebar-trigger"
              render={
                <Button
                  variant="ghost"
                  className="h-auto flex flex-col items-center justify-center gap-0 rounded-md py-1 text-[11px] text-muted-foreground hover:text-foreground"
                />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
              More
            </SheetTrigger>
            <SheetContent
              data-testid="mobile-sidebar-content"
              side="left"
              className="w-64 bg-surface border-r border-border p-0 flex flex-col"
            >
              <SheetTitle className="sr-only">More navigation</SheetTitle>
              <div className="p-4 border-b border-border">
                <h2 className="font-display text-lg font-bold">{BRAND_EMOJIS.primary} {BRAND_NAME}</h2>
              </div>
              <div className="flex-1 p-3 overflow-y-auto">
                <NavLinks items={selectMobileSecondaryNavItems()} onNavigate={() => setOpen(false)} />
              </div>
              <div className="p-3 border-t border-border">
                <LogoutFooter
                  deferred
                  onDeferredLogout={() => {
                    setOpen(false)
                    queueMicrotask(() => {
                      openDeferredLogoutDialog()
                    })
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </div>

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
    </>
  )
}
