# Chat UX Refresh Design Notes

## Context
This update refreshes the `/coach` chat experience for mobile and desktop consistency, visual clarity, and interaction stability.

## Goals
- Make top navigation controls consistent across breakpoints.
- Improve glassmorphism treatment without reducing readability.
- Keep chat composer/status controls anchored and usable on small screens.
- Improve message rendering ergonomics and reduce visual noise.
- Preserve user selection state for provider/model across refresh.

## Non-Goals
- Backend model/provider policy changes.
- Chat content-generation logic changes.
- New API contracts.

## UX Decisions

### 1. Top Controls and CTA Consistency
- Unified `Ask Sifu` CTA style and breakpoint behavior.
- Reduced overlap issues by using clearer breakpoint transitions between mobile floating controls and desktop controls.
- Added home icon in front of `Sifu Quest` CTA for quicker recognition.

### 2. Glassmorphism Layering
- Removed opaque/strip-like top bar behavior and switched to transparent/floating treatment.
- Tuned blur, border alpha, and tint levels to keep controls visible while preserving see-through effect.

### 3. Composer + Status Area
- Kept status/composer stack in a floating glass container.
- Added concise AI disclaimer directly below composer in the same container for readability.
- Updated cost label to `Est. cost $...`.
- Removed `Turns` from status strip summary/details per UX preference.

### 4. Chat Bubble Rendering
- Reduced visual banding by flattening assistant bubble background from multi-stop gradient to stable surface tint.
- Preserved contrast and readability with border/shadow.

### 5. Selection Persistence
- Persist selected provider/model in localStorage.
- Restore preference with safe fallback if model becomes unavailable.
- Priority order: active session selection -> stored selection -> server defaults.

## Responsiveness Strategy
- Avoid pixel-dependent behavior where possible; use breakpoint-based layout switching.
- Mobile: floating top controls.
- Desktop/tablet-up: stable inline header controls.

## Risks and Mitigations
- Risk: reduced contrast when increasing transparency.
  - Mitigation: maintain text color contrast and borders while lowering background opacity.
- Risk: stale stored model after provider updates.
  - Mitigation: resolve stored selection against current available models with fallback.

## Validation Checklist
- Mobile/desktop header controls do not overlap sidebar brand block.
- Composer remains readable with disclaimer visible.
- Status strip shows free quota + `Est. cost` without `Turns`.
- Refresh retains selected provider/model when still available.
- Assistant bubbles do not show vertical banding artifacts.

## Follow-ups
- Add UI snapshot tests for key breakpoints (mobile, tablet, desktop).
- Add a small e2e check for provider/model persistence across page reload.
