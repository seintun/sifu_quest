# Plan: Sifu Quest — Web Dashboard

## Context

Sifu Quest repo is a markdown-based Claude Code coaching workspace (no existing code). The goal is to build a local web app (Next.js) that serves as a visual diary and dashboard for the job search journey — showing progress metrics, a calendar, domain-specific trackers, an interactive plan, and an integrated coaching chat. All data lives in the existing `/memory/*.md` files, which the app reads and selectively updates through structured UI interactions. The Memory Viewer page is **read-only** — no freeform editing. Updates to memory happen only through structured UI actions (plan checkboxes, DSA problem logging, job app forms) and the coaching chat.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS + shadcn/ui + `@tailwindcss/typography`
- **Markdown:** `gray-matter` + `react-markdown` + `remark-gfm`
- **Date utils:** `date-fns`
- **Claude API:** `@anthropic-ai/sdk` (claude-sonnet-4-6)
- **Icons:** `lucide-react`
- **Fonts:** `next/font` — Geist (headings) + Inter (body) + Geist Mono (code)
- App lives at `/web` inside the repo, runs locally at `localhost:3000`

---

## Design System — "Deep Focus"

### Philosophy

Dark-mode-first. Near-black zinc base = serious productivity instrument. Six domain accent colors create spatial navigation — you always know where you are. Vibe: _Linear × Vercel × GitHub contribution graph._

### CSS Variables (`web/src/app/globals.css`)

```css
@layer base {
  :root {
    /* Base surfaces */
    --background: 9 9 11; /* zinc-950 #09090B */
    --surface: 24 24 27; /* zinc-900 #18181B */
    --elevated: 39 39 42; /* zinc-800 #27272A */
    --border: 63 63 70; /* zinc-700 #3F3F46 */

    /* Text */
    --foreground: 250 250 250; /* zinc-50  #FAFAFA */
    --foreground-muted: 161 161 170; /* zinc-400 #A1A1AA */
    --foreground-dim: 113 113 122; /* zinc-500 #71717A */

    /* Domain accents — RGB triplets for Tailwind arbitrary opacity */
    --accent-dsa: 99 102 241; /* indigo-500 #6366F1 */
    --accent-jobs: 245 158 11; /* amber-500  #F59E0B */
    --accent-design: 139 92 246; /* violet-500 #8B5CF6 */
    --accent-coach: 14 165 233; /* sky-500    #0EA5E9 */
    --accent-streak: 16 185 129; /* emerald-500 #10B981 */
    --accent-plan: 244 63 94; /* rose-500   #F43F5E */

    /* Semantic */
    --success: 16 185 129; /* emerald-500 */
    --warning: 245 158 11; /* amber-500   */
    --danger: 239 68 68; /* red-500     */
    --info: 14 165 233; /* sky-500     */

    /* shadcn/ui required tokens */
    --card: 24 24 27;
    --card-foreground: 250 250 250;
    --popover: 24 24 27;
    --popover-foreground: 250 250 250;
    --primary: 99 102 241; /* indigo default */
    --primary-foreground: 250 250 250;
    --secondary: 39 39 42;
    --secondary-foreground: 161 161 170;
    --muted: 39 39 42;
    --muted-foreground: 113 113 122;
    --accent: 39 39 42;
    --accent-foreground: 250 250 250;
    --destructive: 239 68 68;
    --destructive-foreground: 250 250 250;
    --input: 63 63 70;
    --ring: 99 102 241;
    --radius: 0.5rem;
  }
}

@layer base {
  body {
    @apply bg-[rgb(var(--background))] text-[rgb(var(--foreground))];
    font-family: "Inter", sans-serif;
  }
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-family: "Geist", sans-serif;
  }
  code,
  pre,
  kbd {
    font-family: "Geist Mono", monospace;
  }
}
```

### Tailwind Config (`web/tailwind.config.ts`)

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        muted: "rgb(var(--foreground-muted) / <alpha-value>)",
        dim: "rgb(var(--foreground-dim) / <alpha-value>)",

        /* Domain accents — use as bg-dsa, text-dsa, border-dsa, etc. */
        dsa: "rgb(var(--accent-dsa) / <alpha-value>)",
        jobs: "rgb(var(--accent-jobs) / <alpha-value>)",
        design: "rgb(var(--accent-design) / <alpha-value>)",
        coach: "rgb(var(--accent-coach) / <alpha-value>)",
        streak: "rgb(var(--accent-streak) / <alpha-value>)",
        plan: "rgb(var(--accent-plan) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Geist", "sans-serif"],
        mono: ["Geist Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        /* Accent glow — used on hover/active cards */
        "glow-dsa": "0 0 20px rgb(99 102 241 / 0.25)",
        "glow-jobs": "0 0 20px rgb(245 158 11 / 0.25)",
        "glow-design": "0 0 20px rgb(139 92 246 / 0.25)",
        "glow-coach": "0 0 20px rgb(14 165 233 / 0.25)",
        "glow-streak": "0 0 20px rgb(16 185 129 / 0.25)",
        "glow-plan": "0 0 20px rgb(244 63 94 / 0.25)",
      },
      animation: {
        "pulse-cursor": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "streak-glow": "streakGlow 2s ease-in-out infinite alternate",
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        streakGlow: {
          "0%": { textShadow: "0 0 8px rgb(16 185 129 / 0.6)" },
          "100%": { textShadow: "0 0 20px rgb(16 185 129 / 0.9)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
```

### shadcn/ui Theme Override (`components.json`)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

### Domain Color Map (used everywhere in code)

```ts
// src/lib/theme.ts  — single source of truth for domain colors
export const DOMAIN_COLORS = {
  dsa: {
    bg: "bg-dsa/10",
    border: "border-dsa/30",
    text: "text-dsa",
    glow: "hover:shadow-glow-dsa",
    hex: "#6366F1",
  },
  jobs: {
    bg: "bg-jobs/10",
    border: "border-jobs/30",
    text: "text-jobs",
    glow: "hover:shadow-glow-jobs",
    hex: "#F59E0B",
  },
  design: {
    bg: "bg-design/10",
    border: "border-design/30",
    text: "text-design",
    glow: "hover:shadow-glow-design",
    hex: "#8B5CF6",
  },
  coach: {
    bg: "bg-coach/10",
    border: "border-coach/30",
    text: "text-coach",
    glow: "hover:shadow-glow-coach",
    hex: "#0EA5E9",
  },
  streak: {
    bg: "bg-streak/10",
    border: "border-streak/30",
    text: "text-streak",
    glow: "hover:shadow-glow-streak",
    hex: "#10B981",
  },
  plan: {
    bg: "bg-plan/10",
    border: "border-plan/30",
    text: "text-plan",
    glow: "hover:shadow-glow-plan",
    hex: "#F43F5E",
  },
} as const;

export type Domain = keyof typeof DOMAIN_COLORS;

// Mastery badge variant map
export const MASTERY_STYLES = {
  "🟢": {
    label: "Mastered",
    className: "bg-streak/20 text-streak border border-streak/30",
  },
  "🟡": {
    label: "Learning",
    className: "bg-jobs/20   text-jobs   border border-jobs/30",
  },
  "🔴": {
    label: "Not Started",
    className: "bg-plan/20   text-plan   border border-plan/30",
  },
  "—": {
    label: "Untouched",
    className: "bg-elevated  text-dim    border border-border",
  },
} as const;
```

### Component Patterns

**Card (base):**

```tsx
// Standard surface card
<div className="rounded-lg border border-border bg-surface p-4 transition-all duration-200 hover:border-border/80">

// Domain-accented card (e.g. DSA)
<div className={cn(
  "rounded-lg border p-4 transition-all duration-200",
  DOMAIN_COLORS.dsa.bg,
  DOMAIN_COLORS.dsa.border,
  DOMAIN_COLORS.dsa.glow
)}>
```

**Sidebar nav item (active state):**

```tsx
// Active: left border + accent text
<Link className={cn(
  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
  isActive
    ? `border-l-2 border-dsa text-dsa bg-dsa/10 font-medium`
    : "text-muted hover:text-foreground hover:bg-elevated"
)}>
```

**Kanban column left-border:**

```tsx
const KANBAN_COLORS = {
  Applied: "border-l-coach",
  PhoneScreen: "border-l-jobs",
  Onsite: "border-l-design",
  Offer: "border-l-streak",
  Rejected: "border-l-border",
};
// Usage: <div className={cn("border-l-4 pl-3", KANBAN_COLORS[status])}>
```

**Progress bar (domain gradient):**

```tsx
// Use inline style for gradient since Tailwind can't generate dynamic gradients
<div className="h-2 rounded-full bg-elevated overflow-hidden">
  <div
    className="h-full rounded-full transition-all duration-500"
    style={{
      width: `${pct}%`,
      background: `linear-gradient(to right, ${startHex}, ${endHex})`,
    }}
  />
</div>
// DSA: indigo→violet  Jobs: amber→orange  Streak: emerald→teal
```

**Calendar dot (activity type):**

```tsx
// Single type
<span className="w-2 h-2 rounded-full bg-dsa inline-block" />
// Multi-type: split using conic-gradient via inline style
<span style={{ background: 'conic-gradient(#6366F1 180deg, #F59E0B 180deg)' }}
      className="w-2 h-2 rounded-full inline-block" />
```

**Coach chat bubbles:**

```tsx
// AI message
<div className="bg-surface border border-coach/20 shadow-glow-coach/5 rounded-lg p-3 text-sm">
// User message
<div className="bg-elevated rounded-lg p-3 text-sm ml-auto max-w-[80%]">
// Streaming cursor
<span className="inline-block w-0.5 h-4 bg-coach animate-pulse-cursor ml-0.5" />
```

**Streak counter (7+ day glow):**

```tsx
<span
  className={cn(
    "text-4xl font-display font-bold tabular-nums",
    streak >= 7 ? "text-streak animate-streak-glow" : "text-foreground",
  )}
>
  {streak}
</span>
```

---

## Project Structure

```
sifu_quest/
└── web/
    ├── .env.local                  ← ANTHROPIC_API_KEY, MEMORY_DIR, MODES_DIR
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx          ← root layout + sidebar nav
    │   │   ├── page.tsx            ← Dashboard
    │   │   ├── calendar/page.tsx
    │   │   ├── dsa/page.tsx
    │   │   ├── system-design/page.tsx
    │   │   ├── jobs/page.tsx
    │   │   ├── plan/page.tsx
    │   │   ├── memory/page.tsx     ← READ-ONLY viewer
    │   │   ├── coach/page.tsx
    │   │   └── api/
    │   │       ├── memory/route.ts         ← GET only (read-only)
    │   │       ├── plan/toggle/route.ts    ← checkbox toggle → writes plan.md
    │   │       ├── progress/route.ts       ← derived metrics
    │   │       └── chat/route.ts           ← Claude streaming proxy
    │   ├── components/
    │   │   ├── layout/ (Sidebar, Header)
    │   │   ├── dashboard/ (TodayFocusCard, MetricsGrid, ProgressBars, ActionItemsCard, ActivityFeed)
    │   │   ├── dsa/ (PatternTable, ProblemHistory, ProblemOfTheDay, PatternDetail, LogProblemForm)
    │   │   ├── jobs/ (KanbanBoard, ApplicationCard, AddApplicationForm)
    │   │   ├── plan/ (MonthTabs, WeeklyRhythm, MonthChecklist, MonthProgress, RedFlags)
    │   │   ├── system-design/ (ConceptsGrid, DiscussionsLog, StudyNextCard)
    │   │   ├── calendar/ (CalendarGrid, DayDetail, StreakCounter)
    │   │   ├── memory/ (FileSidebar, MarkdownPreview — read-only)
    │   │   └── coach/ (ModeSelector, ChatMessages, ChatInput, StreamingMessage)
    │   ├── lib/
    │   │   ├── memory.ts           ← core file I/O (read + write with queue lock)
    │   │   ├── metrics.ts          ← derive DashboardMetrics from all memory files
    │   │   ├── theme.ts            ← DOMAIN_COLORS + MASTERY_STYLES (design tokens)
    │   │   └── parsers/
    │   │       ├── dsa-patterns.ts
    │   │       ├── plan-parser.ts
    │   │       ├── job-search.ts
    │   │       └── system-design.ts
    │   └── hooks/
    │       ├── useMemoryFile.ts    ← fetch-only (no save)
    │       └── useChat.ts
```

---

## Data Storage

All data lives in the existing `/memory/*.md` markdown files — **no database**. The web app:

- Reads files via Next.js server-side API routes (`GET /api/memory?file=X`)
- Writes back only through structured UI actions (plan checkboxes, DSA log forms, job app forms, onboarding wizard)
- The Memory Viewer page is purely read-only — no edit controls, no PUT endpoint exposed
- The coaching chat can suggest memory updates, but the user manually confirms by using the structured forms

---

## Onboarding Wizard (First Launch)

On first launch, if `memory/profile.md` has no name/content yet, the app shows a full-screen setup wizard **before** the dashboard. It mirrors the existing `/start` Claude command (`.claude/commands/start.md`) with the same 8 questions:

1. What's your name?
2. What's your current situation? (employed, job searching, etc.)
3. What are your target roles?
4. What's your primary programming language + DSA interview language?
5. Target companies or tiers?
6. What's your timeline?
7. What are your 2–3 strongest areas?
8. What are 1–2 areas you need to work on?

**Implementation:**

- New page: `/app/onboarding/page.tsx` — multi-step wizard with a progress bar
- Each step is its own component: `components/onboarding/Step{N}.tsx`
- Final step: constructs `profile.md` and `progress.md` content, POSTs to `/api/onboarding` which writes both files
- After save: redirects to `/` (Dashboard)
- The root layout checks for an empty `profile.md` on load and redirects to `/onboarding` if needed
- The `/start` Claude Code command continues to work as-is for CLI users — the web wizard is a parallel path

---

## Pages

| Route            | Purpose                                                                               |
| ---------------- | ------------------------------------------------------------------------------------- |
| `/onboarding`    | First-launch wizard: 8-question setup, writes profile.md + progress.md                |
| `/`              | Dashboard: today's focus, metrics grid, progress bars, action items, activity feed    |
| `/calendar`      | Monthly grid with color-coded activity dots, streak counter, day detail drawer        |
| `/dsa`           | Pattern mastery table (🔴🟡🟢), problem history, Problem of the Day, log problem form |
| `/system-design` | Concepts grid, discussions log, "study next" card                                     |
| `/jobs`          | Kanban board by stage; add/update applications; stale application warnings            |
| `/plan`          | Month tabs, interactive checklists, progress bars, red flags                          |
| `/memory`        | Read-only file viewer: sidebar file selector + rendered markdown preview              |
| `/coach`         | Streaming chat with mode selector; history in localStorage per mode                   |

---

## Implementation Steps

### Step 1 — Scaffold

```bash
cd /Users/seintun/code/sifu_quest
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd web
npx shadcn-ui@latest init   # select: zinc base color, CSS variables: yes
npx shadcn-ui@latest add card badge button progress tabs dialog sheet scroll-area separator table checkbox textarea input label select dropdown-menu tooltip
npm install gray-matter react-markdown remark-gfm @anthropic-ai/sdk lucide-react date-fns
npm install -D @tailwindcss/typography
```

After scaffold, apply the design system:

1. Replace `tailwind.config.ts` with the config from the Design System section above
2. Replace `src/app/globals.css` with the CSS variables block above
3. Create `src/lib/theme.ts` with `DOMAIN_COLORS` and `MASTERY_STYLES`
4. Update `src/app/layout.tsx` to load Geist + Inter via `next/font/google`:

```tsx
import { Inter, Geist, Geist_Mono } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

// Apply to <html>:
<html className={`${inter.variable} ${geist.variable} ${geistMono.variable}`}>
```

`.env.local`:

```
ANTHROPIC_API_KEY=sk-...
MEMORY_DIR=../memory
MODES_DIR=../modes
```

### Step 2 — Data Layer (`lib/memory.ts`)

- `readMemoryFile(filename)` — validates against allowlist, reads from `path.resolve(process.cwd(), '..', 'memory', filename)`
- `writeMemoryFile(filename, content)` — queue-based write lock to prevent concurrent corruption; atomic write (temp file → rename)
- `readModeFile(filename)` — same pattern for `/modes/`
- **Allowlist:** `['profile.md', 'progress.md', 'dsa-patterns.md', 'job-search.md', 'system-design.md', 'plan.md', 'corrections.md', 'ideas.md']`
- All API routes use `export const runtime = 'nodejs'` (not Edge — required for file I/O and Anthropic SDK)

### Step 3 — Parsers

**`parsers/dsa-patterns.ts`**

- Parse the Pattern Mastery table → `DSAPattern[]` (name, mastery: 🔴|🟡|🟢|—, problemsSeen, notes)
- Parse the Problem History table → `ProblemAttempt[]` (skip placeholder rows where all cells are `—`)
- `serializeDSAPatterns()`: patch only the target row in the raw file content (regex line-level replace), never regenerate the whole table

**`parsers/plan-parser.ts`** (most complex)

- Parse WeeklyRhythm table, Month sections (1–3), items grouped by category + week
- Each `PlanItem` gets a stable deterministic ID: `month{N}-{category}-week{W}-{index}` (e.g., `month1-dsa-week1-0`)
- `togglePlanItem(content, itemId, checked)`: locate the exact line by parsing ID → section context → match text, replace `- [ ]` ↔ `- [x]`

**`parsers/job-search.ts`**

- Parse Applications table → `JobApplication[]` (company, role, status, dateApplied, notes)
- `addApplication()`: append row to table in raw content
- `updateApplicationStatus()`: patch status cell on matching row

### Step 4 — API Routes

| Route                | Method | Action                                             |
| -------------------- | ------ | -------------------------------------------------- |
| `/api/memory?file=X` | GET    | Read a memory file (raw content + parsed data)     |
| `/api/progress`      | GET    | Compute and return `DashboardMetrics`              |
| `/api/onboarding`    | POST   | Write profile.md + progress.md from wizard answers |
| `/api/plan/toggle`   | POST   | `{ itemId, checked }` → patch plan.md              |
| `/api/dsa/log`       | POST   | Append problem attempt to dsa-patterns.md          |
| `/api/jobs`          | POST   | Add/update application in job-search.md            |
| `/api/chat`          | POST   | Stream Claude response (Node.js runtime, not Edge) |

**Memory API is GET-only** — no PUT route for the memory viewer (enforcing read-only).

### Step 5 — Layout + Navigation

- Fixed left sidebar with nav items: Dashboard, Calendar, DSA Tracker, System Design, Job Search, 3-Month Plan, Memory, Coach Chat
- Active route highlighted via `usePathname()`
- Mobile: collapsible via shadcn `Sheet`

### Step 6 — Pages (build order validates data layer top-down)

0. **Onboarding Wizard** — build first; gated entry point that populates profile.md
1. **Dashboard** — validates full data pipeline; `computeMetrics()` fetches all files
2. **3-Month Plan** — validates checkbox write-back loop
3. **DSA Tracker** — validates pattern parsing + log problem form
4. **Job Search Kanban** — validates application table parsing + add/update
5. **Memory Viewer** — read-only: file sidebar + `<ReactMarkdown>` preview, no edit controls
6. **Coaching Chat** — streaming API + mode system (system prompt = mode file + relevant memory files)
7. **System Design Tracker** — follows same patterns
8. **Calendar** — derives activity from problem history dates + job application dates

### Step 7 — Key Feature Details

**Today's Focus Card (Dashboard):**

- `date-fns` `getDay()` → map to weekly rhythm from plan.md (Mon=DSA, Tue=Jobs, Wed=System Design, etc.)
- Pull current week's unchecked plan items as action items

**Stale Application Detection (Job Search):**

- If `daysSince(dateApplied) > 21` and status is `Applied` → yellow warning badge on card

**Problem of the Day (DSA):**

- Find first pattern with mastery `—` or `🔴`, surface a suggested problem from the plan's current week checklist

**Coaching Chat system prompt construction:**

```
[mode file content]

---
## Current Memory Context

### Profile
[profile.md content]

### Relevant Domain Memory
[e.g., dsa-patterns.md content for DSA mode]
```

- Chat history stored in `localStorage` keyed by mode — persists across refreshes
- ReactMarkdown + `rehype-highlight` for code syntax highlighting in chat

**Streaming (chat route):**

- `client.messages.stream(...)` → `toReadableStream()` → returned as `text/event-stream`
- Frontend: `ReadableStream` reader, accumulates chunks into the last assistant message

---

## Critical Files

1. `web/src/lib/memory.ts` — All file I/O; path resolution, write locking, allowlist security
2. `web/src/lib/parsers/plan-parser.ts` — Stable item IDs + toggle logic; most complex parser
3. `web/src/app/api/chat/route.ts` — Streaming Claude proxy; must be Node.js runtime
4. `web/src/lib/parsers/dsa-patterns.ts` — Used by Dashboard, DSA Tracker, Calendar, and metrics simultaneously
5. `web/src/app/api/memory/route.ts` — GET-only; no write endpoint exposed

---

## Verification

1. `npm run dev` in `/web` → app loads at localhost:3000
2. Dashboard shows today's focus based on current day of week
3. Plan page: check a box → plan.md on disk updates → uncheck → reverts
4. DSA Tracker: log a problem → dsa-patterns.md Problem History table gains a new row
5. Job Search: add application → job-search.md Applications table gains a new row
6. Memory page: select any file → renders markdown preview → NO edit controls visible
7. Coach Chat: select DSA mode → send a message → streaming response appears; code blocks are syntax-highlighted
8. Calendar: days with logged DSA problems show a colored activity dot
