# OpenRouter Paid BYOK Model Selector Design

## Goals

- Keep one `OpenRouter` provider entry.
- Preserve fast free-tier defaults.
- Surface stronger coding models first when available.

## Selector UX

OpenRouter groups:
- `Recommended for Coding`
- `Free Models`
- `All OpenRouter Models`

Behavior:
- Desktop + mobile: groups are collapsible.
- Defaults: `Recommended` expanded; `Free` and `All` collapsed.
- `All` may be initially truncated; `Load full OpenRouter catalog` expands supply.
- In-menu OpenRouter model search is available.

## Entitlements

- No OpenRouter BYOK: only free models selectable.
- OpenRouter BYOK present: free + paid models selectable.

## Error/State UX

- Full catalog fetch failure keeps current list and shows retry-safe message.
- Decrypt-failed OpenRouter key prompts re-entry.
- Free-model requests may still use shared-key fallback when available; paid requests remain blocked.

## Accessibility

- Ranking badges remain visible with explicit icon semantics.
- Search inputs use explicit accessible naming (`aria-label`).
- Provider labels and key-required states are explicit.
