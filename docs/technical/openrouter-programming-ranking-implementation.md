# OpenRouter Dynamic Programming Ranking: Technical Design

## Summary
The provider catalog now uses dynamic OpenRouter ranking data to order free models for programming use-cases, with graceful fallback to normal catalog behavior when ranking data is unavailable.

## Implemented Components

### 1. Ranking Payload Extraction
- File: `web/src/lib/openrouter-ranking-utils.ts`
- Function: `extractFreeModelIdsFromRankingPayload(payload)`
- Behavior:
  - Accepts ranking payload text (RSC stream or HTML).
  - Extracts free model ids using multiple patterns:
    - `variant_permaslug`
    - ranking anchor hrefs
    - raw `<provider>/<model>:free` tokens
  - Returns deduplicated lowercase model ids in discovery order.
  - Validates extracted ids against model-id shape and ignores captures followed by query/hash delimiters (`?`, `#`) so navigation links do not pollute ranking order.

### 2. Ranking Fetch + Caching
- File: `web/src/lib/provider-catalog.ts`
- Added ranking fetch path:
  - Primary: GET rankings page with `RSC: 1` header.
  - Fallback: GET standard HTML rankings page.
- Performance controls:
  - Short timeout: `AbortSignal.timeout(3500)`
  - App cache: `unstable_cache` revalidate `1800s`
  - In-memory cache for injected fetches: TTL `30m`

### 3. Catalog Integration
- `buildProviderCatalog` now fetches concurrently:
  - free model catalog (`/api/v1/models`)
  - dynamic ranking order
- Sorting logic:
  - If ranking list exists, annotate matching models with `recommendationRank` and sort by rank.
  - If ranking list is empty/unavailable, return original model order unchanged.
- Recommended/open catalog consistency:
  - Recommended models are derived from the same dropdown catalog slice to guarantee recommended ids are selectable within the returned payload.
  - Default OpenRouter model now prefers top recommended entry and falls back to first available catalog item.

### 4. UI Rendering
- File: `web/src/components/chat/ChatControls.tsx`
- Badge rendering based on `recommendationRank`:
  - `#1`: trophy
  - `#2-#3`: medal
  - `#4+`: sparkles
- Grouped menu sections now include:
  - `Recommended for Coding`
  - `Free Models`
  - `All OpenRouter Models`
- `Recommended for Coding` and `All OpenRouter Models` are collapsible/expandable (desktop + mobile).
- `Free Models` provides a free-only filtered list even when BYOK unlocks paid models.

## Failure Handling
The implementation intentionally never blocks chat model loading:

- Ranking endpoint timeout/failure:
  - Logged warning server-side.
  - Returns empty ranking list.
  - Catalog still loads from `/api/v1/models`.
- Ranking payload shape change:
  - Multi-pattern parser attempts extraction.
  - If extraction fails, behavior degrades to normal order.
- Model deprecation/new model release:
  - No static ranking dependency is required for correctness.
  - New models still appear via model catalog endpoint.

## Data Flow
```mermaid
flowchart TD
  API1["OpenRouter /api/v1/models"] --> FREE["freeModels[]"]
  API2["OpenRouter rankings page RSC or HTML"] --> PARSE["extractFreeModelIdsFromRankingPayload"]
  PARSE --> ORDER["dynamicOrder[]"]
  FREE --> APPLY["sortAndAnnotateOpenRouterModels"]
  ORDER --> APPLY
  APPLY --> PROVIDER["Provider catalog response"]
  PROVIDER --> HOOK["useChat bootstrap"]
  HOOK --> DROPDOWN["ChatControls model dropdown"]
```

## Testing
Added and updated unit coverage:
- `web/src/lib/openrouter-ranking-utils.test.mts`
  - validates extraction across payload shapes.
- Existing tests pass with dynamic-only ordering path.

## Operational Notes
- Recommended observability follow-up:
  - metric/log count for ranking extraction success vs failure.
  - optional cache hit ratio for ranking fetch path.
- If OpenRouter exposes a stable rankings JSON API, fetch path can be swapped with minimal UI changes.
