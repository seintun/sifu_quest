# AGENTS.md

Repository-level engineering workflow for feature delivery in `sifu_quest`.

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

Never implement multi-file feature work directly on `main`.

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

