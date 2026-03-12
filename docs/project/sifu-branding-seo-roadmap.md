# Plan: Sifu Branding, SEO, and Ask Sifu Rebrand

## Objective

Centralize all branding, tone, and SEO behavior around Sifu Quest with a consistent "Sifu Master" UX language.

## Core Deliverables

1. Centralized contracts
- `brandCopy`
- `seoConfig`
- `brandTheme`
- `aiToneConfig`

2. Ask Sifu rebrand
- Rename Coach Chat surfaces to `Ask Sifu`
- Rename mode labels:
  - `DSA Sifu`
  - `System Design Sifu`
  - `Interview Prep Sifu`
  - `Job Search Sifu`
  - `Business Ideas Sifu`

3. SEO and metadata
- Rich root metadata in `layout.tsx`
- `manifest`, `robots`, and `sitemap` routes
- Canonical favicon/app icon integration

4. Theme language system
- Emoji principal set: `🥋`, `🏆`, `🏅`, `🥇`, `⭐`, `👊`
- Matching Lucide semantics for UI consistency

5. Documentation
- Architecture remit update for Brand/SEO/AI tone
- Design-system guidance for emoji/icon usage boundaries

## Acceptance Criteria

- Metadata routes are live and tested.
- Ask Sifu naming is consistent across dashboard/chat controls/navigation.
- System prompt includes Sifu Master tone guardrails.
- Legacy boilerplate brand artifacts are removed from web app docs/public assets.
