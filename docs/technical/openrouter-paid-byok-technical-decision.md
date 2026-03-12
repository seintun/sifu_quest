# OpenRouter Paid BYOK: Technical Decision

## Context

- Free OpenRouter usage already existed through shared infra key.
- Key management and entitlement behavior were Anthropic-centric.
- Requirement: unlock paid OpenRouter models via BYOK without splitting provider identity.

## Decision

1. Keep a single provider id: `openrouter`.
2. Centralize entitlement resolution (`providerKeys`, `openRouterModelScope`, `hasAnyProviderKey`) and reuse it in providers/session/chat routes.
3. Support OpenRouter full-catalog BYOK fetch with user-scoped cache; keep global cache for free/ranking paths.
4. Require explicit provider in key APIs (`POST`/`DELETE` for `/api/auth/apikey`).
5. Expose account key status as `hasProviderKey` map.
6. On OpenRouter BYOK decrypt failure:
   - free model + shared key available: allow fallback
   - otherwise: block with key re-add message.
7. Free-model classification accepts `openrouter/free` and `<provider>/<model>:free`; malformed `::free` is rejected.

## Rationale

- Avoids provider duplication/state drift.
- Keeps policy logic DRY and auditable.
- Supports incremental provider expansion.
- Maintains resilient free-tier behavior under key corruption.

## Consequences

- Client/provider payload contracts changed.
- Settings and selection UI became provider-aware.
- Tests expanded for entitlement matrix and edge cases.
