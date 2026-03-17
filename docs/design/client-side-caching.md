# Client UI Loading Strategy

This document outlines the design decisions behind the SWR layout-first loading architecture. The objective is to prioritize an instantaneous perceived performance for returning interactions by transitioning from a blocking, per-page loader approach to an optimistic shell pattern.

## Problem Statement

Initially, React components triggered state-dependent navigation blocks primarily using `useEffect` rendering loops paired with full-screen skeletons. When users clicked between heavily used sections (Dashboard, Coach Chat, System Design, DSA, Memory, Settings), the framework would remount components, wipe state, mount a blocking loading skeleton, await the data API response, and finally mount the UI. Even for cached server actions or returning users, the browser perceived a jarring 400ms – 1s flash while data re-validated.

## Technical Approach

### 1. `useSWR` for Stale-While-Revalidate Caching

All manual `fetch` loops bound to `useEffect` statements have been replaced with Next.js standard `useSWR` bindings.

*   By dropping `useEffect`, developers no longer explicitly manage `isLoading`, `error`, or synchronous data injection flows.
*   SWR defaults to a stale-while-revalidate pattern. When a user navigates to the *Dashboard* tab, SWR immediately renders the last known component layout directly from its rapid local cache. Concurrently, SWR pings the `/api/progress` and `/api/onboarding/status` endpoints in the background, smoothly substituting values if they have changed.

### 2. Immediate Layout Paint over Blocking Skeletons

To enhance the visual responsiveness of SWR's cache hits:

*   The Next.js `loading.tsx` and per-file suspense boundaries that forced an empty screen were rolled back in areas that contained structural metadata.
*   The page layouts (Search bars, Navigation menus, Title headers) are now decoupled from the async data requirement. If `!metrics` is currently in flight during the very first cold load, only the *internal cards* render localized `animate-pulse` skeletons. The user never sees a missing page layout.

### 3. SWR Mutation Overlays

For mutations (e.g., submitting a job application or checking off a DSA problem status):

*   When called as `mutate()` with no data argument, SWR simply revalidates the resource while continuing to serve the last cached (stale) value, avoiding jarring loading states.
*   For true optimistic UI, the mutation path uses `mutate(optimisticData, { revalidate: true | false })`, which immediately writes `optimisticData` into the cache so the UI reflects the expected result before the API response is confirmed.

## UX Principles Applied

*   **Never block the frame:** Navigation should physically react to the click instantly.
*   **Progressive Loading:** Show as much of the page structure as possible. If only the *streak counter* is missing data, only the *streak counter* should show a skeleton loader, not the entire screen.
*   **Predictable Resumption:** If an application section was viewed in the last 10 minutes, returning to it should result in an immediate paint without loading states.

## Future Recommendations

*   Ensure any newly added Dashboard components strictly adhere to `useSWR(endpoint, fetcher)`.
*   Avoid adding high-level `Suspense` wraps over root layouts, as this delegates control of the first paint frame to the slowest resolving internal promise.
