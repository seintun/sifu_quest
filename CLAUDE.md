# CLAUDE.md — Sifu Quest Engineering Guide

Single source of truth for coding conventions, architecture, and workflow.
Compatible with Claude Code, Gemini, Codex, Cursor, and other AI agents.

## 1. Identity & Role

Technical Founder & Lead Product Engineer. Evaluate every task across four pillars:

1. **UX/Product** — Solving a real user problem? Is the flow intuitive?
2. **Technical** — Scalable and maintainable (TS/ESM)?
3. **Business** — Impact vs. Effort? Can an MCP tool accelerate this?
4. **Health** — Does this add technical debt or product complexity?

Prefer explicit code over clever abstractions. DRY aggressively. Handle edge cases thoroughly.
Keep designs "engineered enough" (avoid both fragility and over-engineering).

## 2. Project Quick Reference

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React, TypeScript, Tailwind CSS |
| UI | shadcn/ui, Radix primitives |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (Google, Anonymous) |
| AI/LLM | OpenRouter + Anthropic (multi-provider) |
| Monitoring | Sentry, Vercel Analytics |
| Deploy | Vercel |

### Commands (from `web/`)

```sh
npm run dev        # Local dev server
npm run build      # Production build
npm run lint       # ESLint
npm run test       # Unit tests (.test.mts)
npm run test:e2e   # Playwright E2E (.spec.ts)
```

### Directory Map

```
web/src/
  app/          # Next.js routes (API + pages)
  components/   # Shared & feature components
  hooks/        # Custom React hooks
  lib/          # Utilities, theme, supabase client
  context/      # React context providers
  modes/        # Chat mode definitions
  auth.ts       # Auth config
supabase/       # DB migrations & seeds
docs/           # Proposals, technical docs, design system
```

## 3. Workflow: Proposal → Branch → Implement → PR

### New Features

1. Write a proposal (template: `docs/project/feature-proposal-template.md`) — wait for approval.
2. Create branch: `feat/<slug>` (features), `fix/<slug>` (bugs), `chore/<slug>` (maintenance).
3. Implement incrementally with frequent commits — never batch into one giant commit.
4. Open PR using `.github/pull_request_template.md`.

### Commits

Conventional style with scope: `feat(chat): add streaming response handler`.
Describe intent and impact, not just file changes.

### Parallelization

Split work by domain (frontend / backend / db) when tasks are independent.
Use sub-agents for research; keep main context clean.

## 4. Coding Conventions

- **Imports**: `@/` alias (maps to `web/src/`).
- **Components**: PascalCase, organized by feature in `components/`.
- **Utilities**: kebab-case in `lib/`.
- **API Routes**: Zod validation first, `export const runtime = 'nodejs'`, auth check before logic.
- **Styling**: Tailwind + domain colors from `lib/theme.ts`.
- **State**: SWR + optimistic updates for instant UX feedback.

## 5. Architecture Decisions

Key docs (read when relevant to your task):

- `docs/technical/architecture.md` — runtime, infra, core modules
- `docs/technical/database.md` — schema, RLS policies, RPC functions
- `docs/technical/provider-pricing-roadmap.md` — multi-provider AI rollout
- `docs/design/sifu-brand-system.md` — domain colors, typography
- `docs/design/client-side-caching.md` — SWR patterns
- `docs/project/roadmap.md` — product roadmap

Critical patterns:

- **RLS**: Every table has row-level security; never bypass with service key in app code.
- **Encryption**: AES-256-GCM for API keys at rest.
- **Streaming**: All chat responses use SSE streaming; never block on full response.

## 6. Domain Rules

### Frontend

- shadcn/ui components only (no custom primitives unless justified).
- Domain colors from `lib/theme.ts` — never hardcode hex values.
- Optimistic UI for plan toggles and user actions.

### Backend

- Zod schemas for all API input validation.
- Normalize errors to `{ error: string, code: string }` shape.
- Rate limiting on public endpoints.

### Database

- RLS on every table — test policies with service key vs anon key.
- RPC functions for complex queries (avoid client-side joins).
- Migration naming: `YYYYMMDD_description.sql`.

### AI/LLM

- Multi-provider via OpenRouter; abstract behind provider interface.
- Prompt caching where supported.
- Stream all responses; handle model unavailability gracefully.

### Security

- AES-256-GCM for stored API keys.
- Guest session cleanup on expiry.
- Audit logging for sensitive operations.

## 7. Testing

- Unit tests: `.test.mts` files, run with `npm run test`.
- E2E tests: `.spec.ts` files, run with `npm run test:e2e`.
- Required for behavior changes. If deferred, document why + risk + follow-up task.

## 8. CI/CD

- GitHub Actions for lint + test gates.
- Vercel auto-deploys on push to `main`.
- Preview deploys on PRs.

## 9. Lessons Learned (Self-Healing)

Format: `[Date] Mistake → Root Cause → Fix → Rule`

Agents: append entries when you identify a repeated mistake. Active rules override defaults in this file.

<!-- Append lessons below this line -->

## 10. Context & Token Management

- Compact context after ~60% usage or before planning phases (`/compact`).
- Commit at every logical checkpoint — frequent small commits beat one giant commit.
- Use Explore sub-agents for codebase research; keep main context clean.
- Persist architectural decisions to `~/.claude/memory/` across sessions.

## 11. Tool & MCP Usage

- **Web Search**: Latest docs, library versions, best practices. Never guess URLs.
- **MCP GitHub**: PR context, issue tracking, code search before local exploration.
- **MCP Memory**: Cross-session architectural knowledge persistence.
- **CLI**: Prefer `rg --json` for search, `duckdb` for data analysis, `watchexec` for file watching.
- **Dedicated tools over bash**: Read > cat, Edit > sed, Grep > grep.

## 12. Design Decision Reasoning

Every non-obvious architectural decision should include:

**Decision**: X → **Why**: Y → **Tradeoffs**: A/B → **Better Way**: Z

Document in commit messages, PR descriptions, and inline code comments.

## 13. Provider Notes

This file uses vendor-neutral language. AI agents from any provider should:

- Follow the workflow in Section 3 for all feature work.
- Apply coding conventions from Section 4 consistently.
- Reference the architecture docs in Section 5 before making structural changes.
- Append to Section 9 when catching repeated mistakes.
- Prefer MCP/CLI tools from Section 11 over raw bash.
