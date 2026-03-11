# Accessibility Audit & UI Test Identifiers Proposal

Use this template before implementing a new feature or major behavior change.

## 1) Problem Statement

- **What problem exists today?** The application lacks a comprehensive accessibility baseline (WCAG 2.1 AA compliance), meaning users relying on keyboard navigation or screen readers, as well as users with low vision, may face barriers. Additionally, automated UI testing and debugging are difficult because UI components lack consistent test identifiers (`data-testid`).
- **Who is affected?** Users with disabilities (visual, motor). Developers and QA writing automated tests or inspecting the DOM.
- **Why now?** Integrating accessibility and testability early prevents massive technical debt as the number of UI components and views scales.

## 2) Scope

- **In scope:** 
  - Complete WCAG 2.1 AA compliance audit and remediation for existing UI components and layouts.
  - Adding `data-testid` attributes to all generic UI components (`web/src/components/ui/`) as well as main composite components and major page containers.
  - Heading hierarchy normalization.
  - Color contrast validations and adjustments in `globals.css` and Tailwind definitions.
  - Keyboard navigation and focus ring adjustments.
- **Out of scope (non-goals):** 
  - Complete application redesigns unrelated to accessibility.
  - Adding entirely new E2E testing suites containing test scripts (this focuses purely on exposing the `data-testid` hooks for future use). 

## 3) User Stories

- As a **user relying on a screen reader or keyboard**, I want **logical heading structures and clear focus rings**, so that **I can navigate the application efficiently and understand its layout.**
- As a **developer or QA engineer**, I want **clear semantic identifiers (`data-testid`) on all UI elements**, so that **I can easily target them in automated scripts or Chrome DevTools.**

## 4) Acceptance Criteria

- [ ] All `web/src/components/ui/*` elements support and forward a `data-testid` property.
- [ ] Major application views and sections have standard identifiers (e.g., `data-testid="sidebar-nav"`, `data-testid="dashboard-metrics-grid"`).
- [ ] Keyboard navigation flows sequentially and all focusable elements have a clear visible focus indicator (contrast ratio >= 3:1).
- [ ] Color contrast ratios for text and crucial UI borders meet WCAG 2.1 AA standards (>= 4.5:1 for normal text, >= 3:1 for large text/icons).
- [ ] Headings on core pages nest logically without skipping levels (H1 -> H2 -> H3).
- [ ] All interactive components have appropriate ARIA roles and labels.

## 5) Architecture and Data Flow

- **Component boundaries:** Structural changes will exclusively be contained within the React component layer (TSX) and CSS baseline (`globals.css`).
- **Data flow:** We will allow `data-testid` to be passed as standard HTML attributes through component props, destructuring and applying them to the root DOM elements of the component.
- **API boundaries:** N/A (Frontend only change).
- **Auth/data access/security implications:** None. Test IDs should not expose sensitive User PII.

## 6) Technical Approach

- **Proposed implementation plan:** 
  1. Update all component interfaces in `components/ui/` to accept a `data-testid?: string` prop if they don't already (standard React HTML attributes usually include it, but we need to ensure it forwards to the root node explicitly).
  2. Map through `app/` and composite `components/` and supply `data-testid="[domain]-[element]"` attributes.
  3. Modify standard focus utility classes in Tailwind/globals if necessary to enforce visibility. 
  4. Manually run accessibility linters/audits (e.g., Lighthouse) on development endpoints.
- **Why this approach:** Modifying the root UI components ensures that any new view built by developers will inherently support test IDs. Treating accessibility as a fundamental feature of the UI kit prevents cascading violations.
- **Dependencies or migrations:** None.

## 7) Alternatives Considered

### Option A (Recommended)
- **Impact:** Extremely high for long-term health, testability, and inclusivity.
- **Effort:** Medium. Requires touching many files, but the changes are highly repetitive and low-risk.
- **Risks:** Slight risk of disrupting existing precise layout mechanisms if we alter semantic DOM elements (like changing a `div` to a `<button>`), requiring re-styling checks.
- **Maintenance cost:** Very low, becomes standard convention.

### Option B (Adding test classes instead of data-testid)
- **Impact:** Achieves testability, but conflates CSS styling concerns with testing concerns.
- **Effort:** Same as Option A.
- **Risks:** High risk that developers accidentally use test classes for styling or remove them thinking they are unused CSS.
- **Maintenance cost:** High.

### Option C (Do Nothing)
- **Impact:** Application becomes increasingly hard to test via automation, blocking velocity as complexity grows.
- **Effort:** None.
- **Risks:** Non-compliance with standard accessibility guidelines.
- **Maintenance cost:** Very high long-term testing debt.

## 8) Risks and Tradeoffs

- **Known risks:** Some third-party elements (like Radix primitives in `shadcn/ui`) manage their own accessibility; we must ensure our wrappers do not conflict with or override their built-in keyboard controls.
- **Tradeoffs accepted:** Code verbosity will slightly increase due to the presence of `data-testid` tags.
- **Rollback strategy:** Revert branch.

## 9) Edge Cases and Failure Modes

- **Edge case 1:** Components composed of multiple interactive elements (e.g., `DropdownMenu` with multiple items) should propagate specific IDs to inner elements (e.g., `data-testid="menu-item-[value]"`).

## 10) Test Strategy

- **Integration tests:** We are setting the stage for these tests to be written in the future.
- **E2E/manual verification:** 
  - Run Lighthouse accessibility audit on the Dashboard, Login, and Onboarding views.
  - Unplug mouse/disable trackpad and complete the application authentication flow using only the `Tab`, `Enter`, and Spacebar keys. 
- **Deferred tests (if any) with rationale and follow-up issue:** E2E automated test scripts are deferred, as the scope of this proposal is purely the *enabling* mechanism (`data-testid`) and manual accessibility baseline fixing.
