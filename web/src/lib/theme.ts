export const DOMAIN_COLORS = {
  dsa:    { bg: 'bg-dsa/10',    border: 'border-dsa/30',    text: 'text-dsa',    glow: 'hover:shadow-glow-dsa',    hex: '#6366F1' },
  jobs:   { bg: 'bg-jobs/10',   border: 'border-jobs/30',   text: 'text-jobs',   glow: 'hover:shadow-glow-jobs',   hex: '#F59E0B' },
  design: { bg: 'bg-design/10', border: 'border-design/30', text: 'text-design', glow: 'hover:shadow-glow-design', hex: '#8B5CF6' },
  coach:  { bg: 'bg-coach/10',  border: 'border-coach/30',  text: 'text-coach',  glow: 'hover:shadow-glow-coach',  hex: '#0EA5E9' },
  streak: { bg: 'bg-streak/10', border: 'border-streak/30', text: 'text-streak', glow: 'hover:shadow-glow-streak', hex: '#10B981' },
  plan:   { bg: 'bg-plan/10',   border: 'border-plan/30',   text: 'text-plan',   glow: 'hover:shadow-glow-plan',   hex: '#F43F5E' },
} as const

export type Domain = keyof typeof DOMAIN_COLORS

export const MASTERY_STYLES = {
  '🟢': { label: 'Mastered',    className: 'bg-streak/20 text-streak border border-streak/30' },
  '🟡': { label: 'Learning',    className: 'bg-jobs/20 text-jobs border border-jobs/30' },
  '🔴': { label: 'Not Started', className: 'bg-plan/20 text-plan border border-plan/30' },
  '—':  { label: 'Untouched',   className: 'bg-elevated text-dim border border-border' },
} as const

export type MasteryLevel = keyof typeof MASTERY_STYLES

export const KANBAN_COLORS: Record<string, string> = {
  Applied:     'border-l-coach',
  PhoneScreen: 'border-l-jobs',
  Onsite:      'border-l-design',
  Offer:       'border-l-streak',
  Rejected:    'border-l-border',
}
