'use client'

import { useAuthStatus } from '@/context/AuthStatusContext'
import { startGuestGoogleUpgrade } from '@/lib/guest-upgrade'
import { cn } from '@/lib/utils'
import { Clock, User } from 'lucide-react'
import { useEffect, useState } from 'react'

const GoogleIcon = () => (
  <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-2" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
)

interface GuestExpiryBannerProps {
  variant?: 'banner' | 'card'
  onSignOut?: () => void
}

export function GuestExpiryBanner({ variant = 'banner', onSignOut }: GuestExpiryBannerProps) {
  const { accountStatus, isGuest } = useAuthStatus()
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isUpgrading, setIsUpgrading] = useState(false)

  const guestExpiresAt = accountStatus?.guestExpiresAt

  useEffect(() => {
    if (!guestExpiresAt) return

    const calculateTimeLeft = () => {
      const expiresAt = new Date(guestExpiresAt).getTime()
      const now = new Date().getTime()
      const diff = expiresAt - now

      if (diff <= 0) {
        return 'Expired'
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      if (hours > 0) {
        return `${hours}h ${minutes}m left`
      }
      return `${minutes}m left`
    }

    setTimeLeft(calculateTimeLeft())
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 60000)

    return () => clearInterval(timer)
  }, [guestExpiresAt])

  if (!isGuest || !guestExpiresAt) return null

  const formattedExpiry = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short',
  }).format(new Date(guestExpiresAt))

  const handleUpgrade = async () => {
    setIsUpgrading(true)
    await startGuestGoogleUpgrade(window.location.origin)
    setIsUpgrading(false)
  }

  if (variant === 'card') {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface/60 p-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3 mb-3">
          <User className="h-5 w-5 text-emerald-400" />
          <h3 className="font-display text-lg font-bold text-white">Guest Session</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          You&apos;re browsing as a guest. Your progress is saved temporarily — it will be lost if you sign out without linking Google.
        </p>
        <div className="flex items-center gap-2 mb-4 text-xs">
          <Clock className="h-3.5 w-3.5 text-danger" />
          <span className="font-bold text-danger">{timeLeft}</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="text-muted-foreground">Expires {formattedExpiry}</span>
        </div>
        <button
          onClick={handleUpgrade}
          disabled={isUpgrading}
          className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50"
        >
          {isUpgrading ? "Linking..." : "Link Google Account"}
        </button>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-surface/40 p-1 backdrop-blur-sm transition-all duration-300 hover:border-white/10">
      <div className="flex flex-row items-center justify-between gap-3 px-3 py-1.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <User className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">Guest Session</span>
              <span className="text-[10px] font-bold text-danger flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {timeLeft}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-none">
              Expires at {formattedExpiry}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className={cn(
              "shrink-0 flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] sm:text-[11px] font-bold text-white transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50 shadow-sm"
            )}
          >
            {isUpgrading ? "Linking..." : (
              <>
                <GoogleIcon />
                Link Google Account
              </>
            )}
          </button>
          
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-danger/20 bg-danger/5 px-3 py-1.5 text-[10px] sm:text-[11px] font-bold text-danger transition-all hover:bg-danger/10 active:scale-[0.98]"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
