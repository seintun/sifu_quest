# AGENTS.md

Repository-level engineering workflow for feature delivery in `sifu_quest`.

## Engineering Preferences (Default)

Use these preferences for proposals, reviews, and implementation decisions unless the user explicitly overrides them:

- Aggressively reduce repetition (DRY).
- Prefer explicit code over clever abstractions.
- Handle edge cases thoroughly over optimistic assumptions.
- Keep designs "engineered enough" (avoid both fragility and over-abstraction).
- Treat testing as non-negotiable for behavior changes.

## Default Feature Workflow (Mandatory)

When implementing a **new feature**, follow this sequence:

1. Write a proposal before code changes.
2. Wait for user approval on the proposal direction.
3. Create a dedicated PR branch.
4. Implement incrementally with frequent commits.
5. Open/update PR description using the project template.

## 1) Proposal Requirements (Before Coding)

Every feature proposal must include:

- Problem statement
- Scope
- Non-goals
- User stories
- Acceptance criteria
- Technical approach
- Risks/tradeoffs
- Test strategy
- Mermaid diagram(s) when architecture/flow is non-trivial

Keep proposals explicit and practical. Prefer concrete decisions over vague options.

## 2) Branching Rules

For feature implementation, create a branch before editing code:

- `feat/<short-slug>` for features
- `fix/<short-slug>` for bug fixes
- `chore/<short-slug>` for maintenance/tooling

Never implement feature work directly on `main`.

## 3) Commit Cadence and Message Quality

Commit frequently at logical checkpoints (not one giant commit at the end).

Commit message expectations:

- Use conventional style when possible (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`)
- Describe intent and impact, not just file changes
- Reference scope or subsystem when useful

Examples:

- `feat(coaching): add onboarding plan generator for first session`
- `test(chat): cover entitlement edge case for expired trial window`
- `refactor(memory): extract parser to remove duplicate markdown traversal`

## 4) Pull Request Description Requirements

Use `.github/pull_request_template.md` for all PRs.

PR descriptions must include:

- Clear summary
- Link to proposal/design artifact
- Linked user story(ies)
- Acceptance criteria checklist
- Test plan and evidence (or explanation when no tests are needed)
- Risks and rollback notes (if relevant)
- Mermaid diagram(s) when helpful for reviewers

## 5) Testing Expectations

Testing is required for behavior changes unless explicitly exempted with rationale.

Minimum expectations:

- Unit tests for isolated business logic
- Integration tests for API/data-flow behavior changes
- Manual verification notes for UI workflows when automated coverage is absent

If tests are deferred, document:

- Why deferment is necessary
- Exact risk introduced
- Follow-up issue/task to close the gap

## 6) Plan Review Protocol (Before Medium/Large Changes)

For architecture, refactor, or behavior-heavy work, run an interactive planning review before implementation.

### Start Mode Selection

Offer one of:

1. BIG CHANGE: Review by section in order with at most 4 top issues each:
   Architecture -> Code Quality -> Tests -> Performance.
2. SMALL CHANGE: Review one high-value question per section.

### Required Review Sections

For each section, evaluate:

1. Architecture: boundaries, coupling, data flow, bottlenecks, scaling, auth/data access/API boundaries.
2. Code Quality: organization, DRY violations, error handling, edge-case gaps, debt hotspots, over/under-engineering.
3. Tests: unit/integration/e2e coverage, assertion quality, failure modes, edge-case coverage.
4. Performance: N+1 risks, memory pressure, caching opportunities, high-complexity paths.

### Required Issue Format

For every issue raised:

1. Classify as bug, smell, design concern, or risk.
2. Cite concrete file and line references.
3. Provide 2-3 options (including "do nothing" when reasonable).
4. For each option include:
   - Impact and implementation effort
   - Risk
   - Impact on adjacent code
   - Maintenance burden
5. Give an opinionated recommendation mapped to the Engineering Preferences section.
6. Ask for user direction before implementation.

### Interaction Rules

- After each section, pause for feedback before moving to the next.
- Number issues and letter options for disambiguation.
- Present the recommended option first.
- Do not assume timeline, scope, or priority without explicit user confirmation.

## 7) Templates

Use these templates when applicable:

- Feature proposal template: `docs/project/feature-proposal-template.md`
- Plan review template: `docs/project/plan-review-template.md`
