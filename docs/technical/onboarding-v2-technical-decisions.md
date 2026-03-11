# Onboarding V2 Technical Decisions

Date: March 11, 2026  
Scope: Onboarding V2 core flow, enrichment, and game-plan generation pipeline

## Decision 001: Manual Plan Regeneration After Enrichment

- Decision: Enrichment updates set `onboarding_plan_status = not_queued` and do not auto-enqueue generation.
- Why:
  - Removes surprise background work on every profile tweak.
  - Improves perceived responsiveness in enrichment interactions.
  - Lets users control regeneration timing.
- Tradeoff:
  - Requires explicit user action to apply latest enrichment to plan.

## Decision 002: Protect Active Plan Jobs From Requeue Clobbering

- Decision: `POST /api/onboarding/plan/refresh` returns `409` when plan status is already `queued` or `running`.
- Why:
  - Prevents race conditions where active jobs are reset/requeued.
  - Keeps worker attempt/status transitions coherent.
- Tradeoff:
  - Users cannot "double submit" refresh while one is in progress.

## Decision 003: Dedicated Worker Secret Only

- Decision: Internal worker route requires `ONBOARDING_WORKER_SECRET` and does not fall back to auth/session secrets.
- Why:
  - Reduces blast radius if a header token leaks.
  - Enables independent rotation and auditability of worker credentials.
- Tradeoff:
  - Adds an environment configuration requirement for deployments.

## Decision 004: Explicit Migration-Required Error Contract

- Decision: Missing onboarding schema/columns map to `OnboardingMigrationRequiredError`, surfaced by onboarding routes as HTTP `503`.
- Why:
  - Converts ambiguous runtime failures into actionable operational guidance.
  - Aligns behavior across onboarding endpoints.
- Tradeoff:
  - Requires callers/UI to handle service-unavailable states explicitly.

## Decision 005: Broader Missing-RPC Fallback for Batch Memory Writes

- Decision: `writeMemoryFilesBatch` falls back to per-file writes for `42883`, `PGRST202`, or missing-function error messages.
- Why:
  - Improves compatibility across environments with partial migration/state drift.
- Tradeoff:
  - Fallback path can be slower than RPC batch writes.

## Decision 006: Plan Status UX is Header-Centric and Responsive

- Decision:
  - Status chips are shown near "personalized roadmap" context.
  - Primary action (`Generate Updated Plan`) is clear and placement is responsive (desktop title row, mobile full-width).
  - In-progress states are visually emphasized (`queued/running` warning styling).
- Why:
  - Clarifies what is state information vs. clickable action.
  - Reduces mobile cognitive load and layout breakage.
- Tradeoff:
  - Additional view-state complexity in plan page component.

## Decision 007: Explain Regeneration Intent Inline

- Decision: Add tooltip guidance to the refresh CTA describing regeneration behavior and progress preservation.
- Why:
  - Reduces ambiguity around side effects of regeneration.
  - Improves discoverability without adding persistent UI noise.
- Tradeoff:
  - Depends on hover/focus/tap affordance for discoverability.
