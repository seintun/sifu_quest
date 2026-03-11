# Onboarding V2 Plan Revision

Date: March 11, 2026  
Branch: `feat/onboarding-v2-progressive-profiling`

## Why This Revision Exists

This document reconciles the original "Onboarding V2: Faster First Value + Progressive Profiling" plan with what was actually shipped on this branch, including post-implementation UX and reliability refinements.

## Executive Outcome

- Core onboarding is now a conditional 4-6 step flow with autosave + resume.
- App unlock is non-blocking after core completion; plan generation is async and status-driven.
- Enrichment is progressive, but plan regeneration is now user-triggered (manual) rather than automatic.
- Plan page UX was significantly refined after initial implementation (status chips, CTA clarity, mobile-first layout, refresh guidance).

## Plan-to-Implementation Reconciliation

Legend:
- `Shipped`: implemented as originally planned.
- `Shipped (Adjusted)`: implemented with an intentional product/technical change.
- `Deferred`: not implemented in this branch.

1. Replace fixed 13-step onboarding with conditional 4-6 step core flow  
Status: `Shipped`

2. Branch rules for `targetRoles` and `interviewLanguage`  
Status: `Shipped`

3. Selection limits and validation consistency client/server  
Status: `Shipped`

4. Progressive profiling queue (dashboard/coach/settings)  
Status: `Shipped`

5. Draft autosave + resume (local + server)  
Status: `Shipped`

6. Explicit onboarding completion states in DB and route guard behavior  
Status: `Shipped`

7. Async plan generation (queue + worker + retries/backoff)  
Status: `Shipped`

8. Bulk memory writes via RPC with fallback strategy  
Status: `Shipped (Adjusted)`  
Notes: fallback broadened to include `PGRST202` in addition to missing-function code `42883`.

9. Unified account/onboarding status consumption  
Status: `Shipped`

10. Core/enrichment endpoint contracts and legacy shim  
Status: `Shipped`

11. "Enrichment auto-requeues plan generation" behavior  
Status: `Shipped (Adjusted)`  
Original plan: enrichment updates requeue automatically.  
Final behavior: enrichment sets plan status to `not_queued`; user explicitly triggers regeneration.

12. Performance assertions and dedicated integration test coverage for all API outcomes  
Status: `Deferred`  
Notes: strong unit coverage exists; targeted integration/e2e remains follow-up.

## Additional Scope Added After Initial Plan

1. Manual plan refresh UX
- New endpoint: `POST /api/onboarding/plan/refresh`.
- Guarding against duplicate refresh while already `queued/running`.

2. Plan page status transparency and controls
- Explicit status chips (`not_queued`, `queued`, `running`, `failed`, `ready`).
- In-progress disabled CTA states with explicit messaging.
- Up-to-date indicator.

3. Mobile-first UI cleanup on plan page
- Title hierarchy improvements.
- Responsive badge/action placement.
- Reduced vertical dead space.
- Distinctive CTA styling and tooltip guidance.

4. Security + reliability hardening from PR review
- Dedicated worker secret requirement (`ONBOARDING_WORKER_SECRET` only).
- Migration-required error type + route-level `503` responses for missing onboarding schema.

## Known Follow-ups

1. Add route-level integration tests for onboarding v2 error branches (`409`, `503`, stale/requeue race conditions).
2. Add e2e flows for onboarding core min/max branch paths and plan refresh lifecycle.
3. Add cron/worker operational runbook examples to deployment docs.
