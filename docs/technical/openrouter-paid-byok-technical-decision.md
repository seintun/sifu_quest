# OpenRouter Paid BYOK: Technical Decision

## Context
- We already support OpenRouter free models via shared infrastructure key.
- Users can already store provider keys in `user_api_keys`, but chat entitlement and settings UX were Anthropic-centric.
- Goal: unlock paid OpenRouter models when a user adds their own OpenRouter key, while keeping one `OpenRouter` provider in chat.

## Decision
1. Keep a single `openrouter` provider ID.
2. Add user-level entitlement resolution (`providerKeys`, `openRouterModelScope`, `hasAnyProviderKey`) and reuse it in:
   - `/api/chat/providers`
   - `/api/chat/session`
   - `/api/chat`
3. Support OpenRouter BYOK catalog expansion by:
   - keeping global cached free/ranking fetches
   - adding short-lived user-scoped cache for full catalog fetches
4. Require explicit provider in key management API:
   - `POST /api/auth/apikey` requires `{ provider, apiKey }`
   - `DELETE /api/auth/apikey` requires `provider` query param
5. Expose account key status as `hasProviderKey` map instead of Anthropic-only alias fields.

## Rationale
- Avoids provider duplication and state drift in dropdowns.
- Keeps policy enforcement DRY across routes.
- Enables future provider extension by adding key + catalog adapters without rewriting route policy.
- Reduces accidental mis-saves by making provider explicit in key API calls.

## Consequences
- Client contracts changed for provider/account payloads.
- Settings UI must be provider-aware.
- Unit tests need selection and provider-key matrix coverage.
- Full OpenRouter model fetch becomes user-key dependent and must never use shared global cache keys.
