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
- **Guest users** can try the app with 5 free messages — no signup required
- **Logged-in users** bring their own Anthropic API key — your data stays encrypted and private
- **GDPR compliant** — delete your account and all data with one click

---

## How It Works

```
You ←→ Sifu Quest (Next.js on Vercel) ←→ Claude AI (Anthropic)
                    ↕
              Supabase (PostgreSQL)
           Your profile, progress, chat history
```

1. **Sign in** with Google or try as a Guest
2. **Complete onboarding** — Sifu asks a few questions and builds your personalized coaching profile
3. **Pick a mode** (DSA, System Design, Interview, Job Search, or Business Ideas)
4. **Start learning** — Sifu reads your profile and memory files to give you context-aware coaching
5. **Track progress** — your dashboard updates automatically as you log problems, toggle plan items, and chat

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

> **Full setup instructions** (including how to get API keys from Google, Supabase, Anthropic, and Sentry) are in the **[Setup Guide](./SETUP.md)**.

---

## Documentation

| Document | What's Inside |
|----------|--------------|
| **[SETUP.md](./SETUP.md)** | Step-by-step local dev and Vercel production setup, including how to obtain every API key |
| **[TECHNICAL_DOCS.md](./TECHNICAL_DOCS.md)** | Architecture diagrams, database schema, API reference, security model |
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | Quick-reference for Vercel environment variables |

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

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

MIT — clone, fork, adapt freely.
