'use client'

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { getPlanTimelineMeta, parseProfileSnapshot } from '@/lib/profile-timeline'
import { cn } from '@/lib/utils'
import {
    BookOpen,
    Briefcase,
    Calendar,
    ClipboardList,
    Code2,
    LayoutDashboard,
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
  { href: '/plan',          label: 'Plan',           icon: ClipboardList,   color: 'plan' },
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
  const [planLabel, setPlanLabel] = useState('Plan')

  useEffect(() => {
    let active = true

    fetch('/api/memory?file=profile.md')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const profile = parseProfileSnapshot(typeof data.content === 'string' ? data.content : '')
        setPlanLabel(getPlanTimelineMeta(profile.timeline).planLabel)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const label = item.href === '/plan' ? planLabel : item.label
        const isActive = pathname === item.href
        const colors = COLOR_CLASSES[item.color]
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              isActive
                ? `border-l-2 ${colors.border} ${colors.active} font-medium`
                : 'text-muted-foreground hover:text-foreground hover:bg-elevated'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-56 flex-col fixed inset-y-0 left-0 bg-surface border-r border-border z-30">
      <div className="p-4 border-b border-border">
        <h1 className="font-display text-lg font-bold text-foreground">
          Sifu Quest
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Personal Dashboard</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <NavLinks />
      </div>
    </aside>
  )
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface border-b border-border">
      <div className="flex items-center justify-between p-3">
        <h1 className="font-display text-lg font-bold text-foreground">
          Sifu Quest
        </h1>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<button className="p-2 text-muted-foreground hover:text-foreground" />}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </SheetTrigger>
          <SheetContent side="left" className="w-56 bg-surface border-r border-border p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="p-4 border-b border-border">
              <h2 className="font-display text-lg font-bold">Sifu Quest</h2>
            </div>
            <div className="p-3">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
