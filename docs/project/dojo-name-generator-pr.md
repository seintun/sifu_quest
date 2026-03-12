## Summary

This PR delivers OpenRouter paid BYOK support end-to-end with provider-aware entitlements, dynamic catalog handling, and improved model selection UX.

## Problem

OpenRouter usage was effectively free-tier oriented and lacked a safe, unified path to unlock paid models via user BYOK while preserving free-mode behavior.

## Scope

- Provider-aware key validation/storage (`openrouter`, `anthropic`).
- Unified entitlement resolution (`providerKeys`, `openRouterModelScope`, `hasAnyProviderKey`).
- Provider/model selection enforcement across `/api/chat`, `/api/chat/session`, `/api/chat/providers`.
- OpenRouter catalog groups: `Recommended for Coding`, `Free Models`, `All OpenRouter Models`.
- Selector search + collapsible groups (desktop/mobile).
- PR follow-up fixes: parser hardening, default alignment, abort wiring, accessibility labels, malformed `::free` rejection.

## Key Decisions

- Keep one `openrouter` provider id for both free and paid paths.
- Use shared OpenRouter key for free-model fallback when user OpenRouter key cannot be decrypted.
- Resolve defaults from the same catalog payload returned to the client to avoid selection mismatches.
- Treat free models as `openrouter/free` or `<provider>/<model>:free`; reject malformed patterns.

## Commit Review (main..branch)

- `730056a`: BYOK entitlement foundation.
- `03a64d5`, `fb88508`: selector UX/search/layout.
- `9844d64`, `bc27807`: catalog utilities + free-model grouping.
- `fcb4ba5`: review-thread fixes across API/catalog/hook/accessibility.
- `f531688`: strict malformed `::free` rejection.
- `571364c`, `2513996`: documentation updates.

## Risks + Mitigations

- Ranking payload drift: validated extraction + fallback ordering.
- Corrupted stored key: explicit remediation + free-path fallback when safe.
- Truncated catalog mismatch: defaults computed against returned payload.

## Tests

Commands:

```bash
npm run lint -- src/components/chat/ChatControls.tsx src/lib/provider-catalog.ts src/lib/openrouter-ranking-utils.ts src/lib/openrouter-model-catalog-utils.ts src/app/api/chat/route.ts src/hooks/useChat.ts src/app/api/chat/providers/route.ts src/lib/chat-provider-config.ts
npm test
```

Result: lint passes for touched files; test suite passes (131/131).

## Docs

- `docs/technical/openrouter-paid-byok-technical-decision.md`
- `docs/design/openrouter-paid-byok-model-selector-design.md`
- `docs/technical/openrouter-programming-ranking-implementation.md`
