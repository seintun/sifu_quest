# Plan Parser Technical Documentation

The Plan Parser is a robust markdown-to-JSON utility designed to transform LLM-generated interview prep plans into a structured format for the Sifu Quest dashboard.

## Overview

The parser (`web/src/lib/parsers/plan-parser.ts`) processes markdown content line-by-line using a state-machine approach. It identifies various plan components, including metadata, dashboard tables, monthly sections, categories, and tasks.

## Data Structures

### `ParsedPlan`
The root object returned by `parsePlan(content: string)`.

| Property | Type | Description |
| :--- | :--- | :--- |
| `title` | `string` | The plan title (parsed from `# H1`). |
| `metadata` | `PlanMetadata[]` | Key-value pairs from blockquotes (e.g., `> **Key:** Value`). |
| `dashboard` | `object` | Structured data for the "Quick Reference" table. |
| `months` | `MonthSection[]` | Array of monthly breakdown sections. |
| `redFlags` | `object[]` | Common symptoms and fixes. |
| `immediateSteps` | `PlanItem[]` | Critical immediate actions. |

## Parsing Logic

### 1. Metadata
Captured at the top of the file using blockquote syntax:
```markdown
> **Profile Summary:** 3-5 years experience | React specialist
```
The UI further enhances this by splitting pipe-separated strings into individual badges.

### 2. Dashboard Tables
Identifies markdown tables at the top of the plan. It supports alignment markers (`:---`) and treats them as informational dashboard entries.

### 3. Month & Categories
- **Month Headers**: `## Month N — Title`
- **Themes**: `> **Theme:** Description` or `**Theme:** Description`
- **Categories**: `### Category Name`

### 4. Plan Items (Tasks)
Items are parsed from list elements:
- `Checklist`: `- [ ] Task` or `- [x] Task`
- `Regular List`: `- Task` (defaulted to unchecked)
- `Info Headers`: `**Bold Text**` (parsed as informational items without checkboxes)

### 5. ID Generation
The parser generates stable, predictable IDs for items based on their position:
- Format: `month{N}-{category-slug}[-week{W}]-{index}`
- Informational items include an `-info-` segment in their ID to signal the UI to hide the checkbox.

## Toggling State
The `togglePlanItem` function allows for programmatic updates to the markdown content. It uses the `lineIndex` captured during parsing to precisely target the line and toggle between `[ ]`, `[x]`, and regular bullets.

## Technical Details
- **Location**: `web/src/lib/parsers/plan-parser.ts`
- **Testing**: Comprehensive test suite at `web/src/lib/parsers/plan-parser.test.mts`.
- **Logic**: Sequential line processing with a simple state machine (`currentSection`, `currentMonth`, etc.).
