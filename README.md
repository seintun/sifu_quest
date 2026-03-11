# Sifu Quest

**Your path to mastery.** An AI-powered career coaching platform that remembers where you left off, tracks your growth, and adapts to how you learn — so you never prep alone again.

---

## The Problem

Breaking into top-tier tech companies is brutal. You're juggling LeetCode grinding, system design prep, behavioral interview practice, job applications, and resume tailoring — all at once. Most people end up with a messy spreadsheet, 47 browser tabs, and zero sense of whether they're actually making progress.

Existing tools don't help much either:

- **LeetCode** tracks _problems solved_, not _patterns mastered_
- **ChatGPT/Claude** are powerful but stateless — every session starts from scratch
- **Notion/spreadsheets** require constant manual upkeep that falls apart under stress
- **Paid coaching** costs $200+/hr and doesn't scale to daily practice

You need a system that **knows you** — your strengths, your gaps, your timeline — and coaches you through the entire journey without losing context between sessions.

---

## What Sifu Quest Does

Sifu Quest is an AI career coach powered by Claude that **remembers everything**. It turns scattered interview prep into a structured, trackable path to mastery.

### 🧠 It Remembers You
Your profile, learning style, career goals, and technical strengths are stored persistently. Every session picks up exactly where you left off — no re-explaining, no wasted time.

### 📊 It Tracks Your Progress
A visual dashboard shows your current streak, DSA patterns mastered, system design concepts covered, job applications submitted, and daily focus schedule — all auto-updated as you work.

### 🎯 Five Coaching Modes
| Mode | What It Does |
|------|-------------|
| **DSA & LeetCode** | Socratic hints-first coaching with pattern tracking across problems |
| **System Design** | Whiteboarding partner with trade-off analysis and concept tracking |
| **Interview Prep** | Mock behavioral rounds using the STAR method |
| **Job Search** | Application tracking, company research, and strategy |
| **Business Ideas** | Brainstorming and validation for side projects |

### 🔒 Your Data, Your Keys
- **Free mode** uses a shared server OpenRouter key for users without a personal key (guest or signed-in): **10 user messages**
- **Anthropic BYOK** — add your Anthropic API key in **Settings** to use Anthropic models
- **Infrastructure secrets** (`Supabase`, `Google OAuth`, shared `OPENROUTER_API_KEY`) are env-only (`.env.local` or Vercel env vars)
- **Personal Anthropic keys** are encrypted before storage per user in Supabase, plaintext keys are never stored or logged
- **Server-side encryption secret** (`API_KEY_ENCRYPTION_SECRET`) is managed by app operators only; end users never provide it
- **GDPR compliant** — delete your account and all data with one click

---

## Runtime Model

- **Memory Source of Truth:** user memory/profile/plan markdown is stored in Supabase `memory_files`
- **Coaching Modes:** prompts are loaded from `web/src/modes/*.md`
- **Local Claude workspace files** (`.claude/*`, local `memory/*.md`) are tooling context, not the deployed app memory backend

---

## Security & Compliance

Sifu Quest was designed from day one with data privacy and security as non-negotiable requirements.

| Layer | How It's Protected |
|-------|-------------------|
| **API Key Storage** | Users provide only `sk-ant-...`. Keys are encrypted server-side with **AES-256-CBC** and a unique random IV before storage. Plaintext keys are **never stored, logged, or shared**. |
| **Data Isolation** | Every database table uses Supabase **Row Level Security (RLS)**, guaranteeing that User A can never access User B's data — even through direct database queries. |
| **Authentication** | Google OAuth 2.0 via NextAuth.js with JWT-based sessions. Tokens carry only the user's UUID — no sensitive data in the session payload. |
| **Free-tier Guardrails** | Accounts without personal Anthropic keys are sandboxed to **10 user messages** on shared OpenRouter free models, enforced server-side in chat entitlement checks. |
| **GDPR Compliance** | One-click account deletion wipes **all** user data across every table (profile, chat history, memory files, progress, audit logs) and removes the authentication record entirely. |
| **Audit Trail** | Sensitive operations — API key changes, account deletions, plan generation — are logged to a tamper-evident `audit_log` table for full traceability. |
| **Error Monitoring** | Sentry captures errors across client, server, and edge runtimes with configurable sampling rates, providing observability without exposing user data. |
| **Transport Security** | All traffic is served over **HTTPS** via Vercel's automatic TLS. Supabase connections use encrypted channels. |

> For the full technical breakdown of the security model, see [docs/technical/database.md](./docs/technical/database.md).

## How It Works

```
You ←→ Sifu Quest (Next.js on Vercel) ←→ Claude AI (Anthropic)
                    ↕
              Supabase (PostgreSQL)
           Your profile, progress, chat history
```

1. **Sign in** with Google or try as a Guest (free mode starts without personal key)
2. **Complete onboarding** — finish a fast 4-6 step core setup; Sifu queues your personalized plan in the background
3. **Pick a mode** (DSA, System Design, Interview, Job Search, or Business Ideas)
4. **Start learning** — Sifu reads your Supabase memory files to give context-aware coaching
5. **Track progress** — your dashboard updates automatically as you log problems, toggle plan items, and chat
6. **Use Anthropic models** by saving your personal Anthropic key in Settings

Everything is saved in the cloud. Close your laptop, come back tomorrow, and Sifu picks up right where you left off.

---

## Quick Start

### Try It (Hosted)
Visit the deployed app and start a Guest session — no account needed.

### Run It Yourself
```bash
git clone https://github.com/seintun/sifu-quest.git
cd sifu-quest/web
npm install
npm run dev
```

> **Full setup instructions** (including how to get API keys from Google, Supabase, Anthropic, and Sentry) are in the **[Setup Guide](./docs/setup/local-development.md)**.

---

## Documentation

| Document | What's Inside |
|----------|--------------|
| **[docs/technical/](./docs/technical/)** | Architecture diagrams, database schema, API reference, security model |
| **[docs/technical/provider-pricing-roadmap.md](./docs/technical/provider-pricing-roadmap.md)** | Technical decision roadmap for OpenRouter + Anthropic provider strategy, pricing policy, and chat telemetry |
| **[docs/technical/onboarding-v2-technical-decisions.md](./docs/technical/onboarding-v2-technical-decisions.md)** | Technical decisions for onboarding v2 queueing, regeneration, migration handling, and UX states |
| **[docs/setup/](./docs/setup/)** | Step-by-step local development setup and Vercel production deployment |
| **[docs/project/roadmap.md](./docs/project/roadmap.md)** | The comprehensive product roadmap and design system for Sifu Quest |
| **[docs/project/onboarding-v2-plan-revision.md](./docs/project/onboarding-v2-plan-revision.md)** | Plan-vs-shipped reconciliation and additional scope added during onboarding v2 delivery |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (serverless on Vercel) |
| Database | Supabase (PostgreSQL with Row Level Security) |
| AI | Claude by Anthropic |
| Auth | NextAuth.js + Supabase Auth (Google OAuth + Anonymous) |
| Monitoring | Sentry |
| Encryption | AES-256-CBC for stored API keys |

---

## Contributing

1. Read [AGENTS.md](./AGENTS.md) before starting feature work (proposal-first workflow is mandatory).
2. Create a scoped branch (`feat/<slug>`, `fix/<slug>`, or `chore/<slug>`).
3. Write your proposal with [Feature Proposal Template](./docs/project/feature-proposal-template.md) for feature or major behavior changes.
4. For medium/large changes, run an interactive review using [Plan Review Template](./docs/project/plan-review-template.md) before coding.
5. Commit frequently with detailed, intent-focused messages.
6. Push your branch and open a Pull Request using [`.github/pull_request_template.md`](./.github/pull_request_template.md).

---

## License

MIT — clone, fork, adapt freely.
