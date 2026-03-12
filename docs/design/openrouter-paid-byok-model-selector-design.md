# OpenRouter Paid BYOK Model Selector Design

## UX Goals
- Keep one `OpenRouter` provider in provider dropdown.
- Preserve fast default experience for free users.
- When OpenRouter BYOK exists, surface stronger coding models first and allow access to full model list.

## Selector Behavior
- Model menu shows grouped OpenRouter sections:
  - `Recommended for Coding`
  - `Free Models`
  - `All OpenRouter Models`
- Group sections are collapsible/expandable in both desktop and mobile controls.
  - Default: `Recommended for Coding` expanded.
  - Default: `Free Models` and `All OpenRouter Models` collapsed.
- `All OpenRouter Models` can be truncated on initial load for performance.
- When truncated, show `Load full OpenRouter catalog` action in selector.
- Add in-menu search for OpenRouter model IDs/labels.

## Entitlement Behavior
- No OpenRouter key:
  - OpenRouter provider available
  - only free models selectable
- OpenRouter key present:
  - OpenRouter provider remains same
  - free + paid models selectable

## Error/State UX
- If full catalog fetch fails, preserve existing model list and show retry-safe message.
- Invalid/decryption-failed saved provider key returns clear Settings re-entry action message.
- If OpenRouter BYOK decryption fails, free-model requests can still use shared key fallback when available; paid-model requests remain blocked until key is re-added.

## Accessibility/Clarity Notes
- Keep recommendation rank badges visible in OpenRouter lists.
- Keep provider labels explicit (`OpenRouter`, `Anthropic`).
- Keep key-required reasons human-readable in provider/model availability states.
- Ensure OpenRouter in-menu search inputs have explicit accessible names (`aria-label`).
