import {
  Award,
  BookOpen,
  Calendar,
  Hand,
  MessageCircle,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { BRAND_EMOJIS, NAV_COPY } from "./brand.ts";
import type { Domain } from "./theme";

export type DashboardNavId =
  | "dashboard"
  | "coach"
  | "plan"
  | "dsa"
  | "jobs"
  | "system-design"
  | "calendar"
  | "memory"
  | "settings";

export type DashboardNavItem = {
  id: DashboardNavId;
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  domain: Domain;
  priority: number;
  showInSidebar: boolean;
  showInDashboard: boolean;
  showInMobilePrimary: boolean;
};

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  // === GROUP 1: Core (dashboard, coach, plan) ===
  {
    id: "dashboard",
    href: "/",
    label: "Dashboard",
    hint: `${BRAND_EMOJIS.star} Your mastery at a glance`,
    icon: Shield,
    domain: "streak",
    priority: 1,
    showInSidebar: true,
    showInDashboard: false,
    showInMobilePrimary: true,
  },
  {
    id: "coach",
    href: "/coach",
    label: NAV_COPY.askSifu,
    hint: `${BRAND_EMOJIS.primary} Live Sifu feedback`,
    icon: MessageCircle,
    domain: "coach",
    priority: 2,
    showInSidebar: true,
    showInDashboard: true,
    showInMobilePrimary: true,
  },
  {
    id: "plan",
    href: "/plan",
    label: "Game Plan",
    hint: `${BRAND_EMOJIS.medal} Review this week's priorities`,
    icon: Trophy,
    domain: "plan",
    priority: 3,
    showInSidebar: true,
    showInDashboard: true,
    showInMobilePrimary: true,
  },

  // === GROUP 2: Trackers (dsa, system, jobs, calendar) ===
  {
    id: "dsa",
    href: "/dsa",
    label: "DSA Tracker",
    hint: `${BRAND_EMOJIS.fist} Solve by pattern and level up`,
    icon: Hand,
    domain: "dsa",
    priority: 4,
    showInSidebar: true,
    showInDashboard: true,
    showInMobilePrimary: false,
  },
  {
    id: "system-design",
    href: "/system-design",
    label: "System Design Tracker",
    hint: `${BRAND_EMOJIS.star} Capture architecture tradeoffs`,
    icon: Sparkles,
    domain: "design",
    priority: 5,
    showInSidebar: true,
    showInDashboard: false,
    showInMobilePrimary: false,
  },
  {
    id: "jobs",
    href: "/jobs",
    label: "Job Search Tracker",
    hint: `${BRAND_EMOJIS.trophy} Keep your pipeline sharp`,
    icon: Award,
    domain: "jobs",
    priority: 6,
    showInSidebar: true,
    showInDashboard: true,
    showInMobilePrimary: false,
  },
  {
    id: "calendar",
    href: "/calendar",
    label: "Calendar",
    hint: `${BRAND_EMOJIS.award} Track your daily cadence`,
    icon: Calendar,
    domain: "streak",
    priority: 7,
    showInSidebar: true,
    showInDashboard: false,
    showInMobilePrimary: false,
  },

  // === GROUP 3: Workspace (memory, settings) ===
  {
    id: "memory",
    href: "/memory",
    label: "Memory",
    hint: `${BRAND_EMOJIS.primary} Revisit notes and corrections`,
    icon: BookOpen,
    domain: "streak",
    priority: 7,
    showInSidebar: true,
    showInDashboard: false,
    showInMobilePrimary: false,
  },
  {
    id: "settings",
    href: "/settings",
    label: "Settings",
    hint: `${BRAND_EMOJIS.star} Update profile and API key`,
    icon: Settings,
    domain: "streak",
    priority: 8,
    showInSidebar: true,
    showInDashboard: false,
    showInMobilePrimary: false,
  },
];

export function selectSidebarNavItems(): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => item.showInSidebar);
}

export function selectDashboardLaunchpadItems(
  limit: number = 3,
): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => item.showInDashboard)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);
}

export function selectMobilePrimaryNavItems(): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => item.showInMobilePrimary).sort(
    (a, b) => a.priority - b.priority,
  );
}

export function selectMobileSecondaryNavItems(): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter(
    (item) => item.showInSidebar && !item.showInMobilePrimary,
  ).sort((a, b) => a.priority - b.priority);
}
