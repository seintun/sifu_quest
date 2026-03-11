import {
  BookOpen,
  Briefcase,
  Calendar,
  ClipboardList,
  Code2,
  LayoutDashboard,
  MessageCircle,
  Network,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { Domain } from '@/lib/theme'

export type DashboardNavId =
  | 'dashboard'
  | 'coach'
  | 'plan'
  | 'dsa'
  | 'jobs'
  | 'system-design'
  | 'calendar'
  | 'memory'
  | 'settings'

export type DashboardNavItem = {
  id: DashboardNavId
  href: string
  label: string
  hint: string
  icon: LucideIcon
  domain: Domain
  priority: number
  showInSidebar: boolean
  showInDashboard: boolean
  showInMobilePrimary: boolean
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    id: 'dashboard',
    href: '/',
    label: 'Dashboard',
    hint: 'Your interview prep at a glance',
    icon: LayoutDashboard,
    domain: 'streak',
    priority: 99,
    showInSidebar: true,
    showInDashboard: false,
    showInMobilePrimary: true,
  },
  {
    id: 'coach',
    href: '/coach',
    label: 'Coach Chat',
    hint: 'Get feedback for interview prep',
    icon: MessageCircle,
    domain: 'coach',
    priority: 1,
    showInSidebar: true,
    showInDashboard: true,
    showInMobilePrimary: true,
  },
  {
    id: 'plan',
    href: '/plan',
    label: 'Game Plan',
    hint: 'Review this week\'s priorities',
    icon: ClipboardList,
    domain: 'plan',
    priority: 2,
    showInSidebar: true,
    showInDashboard: true,
    showInMobilePrimary: true,
  },
  {
    id: 'dsa',
    href: '/dsa',
    label: 'Practice DSA',
    hint: 'Solve by pattern and track mastery',
    icon: Code2,
    domain: 'dsa',
    priority: 3,
    showInSidebar: true,
    showInDashboard: true,
    showInMobilePrimary: false,
  },
  {
    id: 'jobs',
    href: '/jobs',
    label: 'Log Applications',
    hint: 'Keep your pipeline updated',
    icon: Briefcase,
    domain: 'jobs',
    priority: 4,
    showInSidebar: true,
    showInDashboard: true,
    showInMobilePrimary: false,
  },
  {
    id: 'system-design',
    href: '/system-design',
    label: 'System Design',
    hint: 'Capture concepts and depth',
    icon: Network,
    domain: 'design',
    priority: 5,
    showInSidebar: true,
    showInDashboard: false,
    showInMobilePrimary: false,
  },
  {
    id: 'calendar',
    href: '/calendar',
    label: 'Calendar',
    hint: 'See your interview schedule',
    icon: Calendar,
    domain: 'streak',
    priority: 6,
    showInSidebar: true,
    showInDashboard: false,
    showInMobilePrimary: false,
  },
  {
    id: 'memory',
    href: '/memory',
    label: 'Memory',
    hint: 'Revisit notes and corrections',
    icon: BookOpen,
    domain: 'streak',
    priority: 7,
    showInSidebar: true,
    showInDashboard: false,
    showInMobilePrimary: false,
  },
  {
    id: 'settings',
    href: '/settings',
    label: 'Settings',
    hint: 'Update your profile and API key',
    icon: Settings,
    domain: 'streak',
    priority: 8,
    showInSidebar: true,
    showInDashboard: false,
    showInMobilePrimary: false,
  },
]

export function selectSidebarNavItems(): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => item.showInSidebar)
}

export function selectDashboardLaunchpadItems(limit: number = 3): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS
    .filter((item) => item.showInDashboard)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit)
}

export function selectMobilePrimaryNavItems(): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS
    .filter((item) => item.showInMobilePrimary)
    .sort((a, b) => a.priority - b.priority)
}

export function selectMobileSecondaryNavItems(): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS
    .filter((item) => item.showInSidebar && !item.showInMobilePrimary)
    .sort((a, b) => a.priority - b.priority)
}
