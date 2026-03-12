# Chat Markdown Guidelines

This document defines formatting best practices for AI-generated markdown content across chat, plan, and memory surfaces.

## Goals

- Keep responses readable on mobile and desktop.
- Preserve semantic structure (headings, lists, code, tables).
- Prevent malformed streamed text from producing broken UI.
- Avoid wasted vertical space while preserving visual rhythm.

## Authoring Contract (Model Output)

Prompt AI responses to follow this structure:

- Use `##` and `###` for section headings.
- Use `-` bullets for unordered lists and `1.` for ordered steps.
- Use fenced code blocks with language tags (for example, ```python).
- Use `---` only between major sections.
- Keep paragraphs short (2-4 lines).
- Prefer lists over dense wall-of-text for procedures and checklists.

## Rendering Stack

Shared project standard:

- `react-markdown`
- `remark-gfm`
- `remark-breaks` (chat only, where streamed line breaks should be honored)
- `rehype-highlight` (chat code blocks)

## Shared Normalization Rules

Before rendering markdown, normalize text with `normalizeMarkdownContent` from:

- `web/src/lib/markdown-formatting.ts`

Normalization behavior:

- Convert CRLF to LF.
- Fix malformed bullets (`-item` -> `- item`).
- Normalize em/en dash bullets (`— item` -> `- item`).
- Normalize divider-like lines (`***`, `___`) to `---`.
- Remove trailing whitespace before newlines.
- Collapse 3+ blank lines to 2.
- Trim trailing blank lines.

## UX Styling Principles

- Keep heading/paragraph/list spacing balanced; avoid both cramped and overly airy rhythm.
- Use subtle divider spacing and borders to separate major sections.
- Ensure list markers are visible and scannable.
- Keep code blocks visually distinct with language labels and horizontal scroll isolation.
- Constrain content width and bubble padding for comfortable reading.

## Current Integration Points

Normalization is applied in:

- Chat bubble markdown renderer:
  - `web/src/components/chat/ConversationList.tsx`
- Memory markdown reader:
  - `web/src/app/(dashboard)/memory/page.tsx`
- Plan markdown renderer and checklist item markdown:
  - `web/src/app/(dashboard)/plan/page.tsx`

## Do / Don’t

Do:

- Prefer `## Core Idea`, `## Approach`, `## Complexity`, `## Next Step`.
- Use bullets for options and checklists.
- Use explicit labels for metrics (`Time:`, `Space:`).

Don’t:

- Emit long unbroken paragraphs.
- Emit malformed list prefixes from streaming chunks.
- Overuse decorative separators.

## Maintenance Note

If markdown formatting behavior changes, update:

1. `web/src/lib/markdown-formatting.ts`
2. This guideline doc
3. All markdown renderers that consume normalized content

