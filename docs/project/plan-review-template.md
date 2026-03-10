# Plan Review Template

Use this template for medium/large changes before implementation.

## Mode Selection

- [ ] BIG CHANGE: Up to 4 top issues per section (Architecture -> Code Quality -> Tests -> Performance)
- [ ] SMALL CHANGE: One high-value question per section

## Engineering Preferences Check

- [ ] DRY first: repetition identified and addressed
- [ ] Explicit over clever
- [ ] Edge cases and failure paths handled
- [ ] "Engineered enough" balance
- [ ] Testing depth is sufficient for behavior risk

## Section 1: Architecture

For each issue, use this format:

### Issue `<number>`: `<title>` (`bug | smell | design concern | risk`)

- Problem:
- Evidence (file:line):
- Impact:

Options:

- A (Recommended): `<option>`
  - Effort:
  - Risk:
  - Cross-code impact:
  - Maintenance burden:
- B: `<option>`
  - Effort:
  - Risk:
  - Cross-code impact:
  - Maintenance burden:
- C (Do nothing, if reasonable): `<option>`
  - Effort:
  - Risk:
  - Cross-code impact:
  - Maintenance burden:

AsUserQuestion:
- Issue `<number>` Option A (Recommended): `<choice summary>`
- Issue `<number>` Option B: `<choice summary>`
- Issue `<number>` Option C: `<choice summary>`

## Section 2: Code Quality

Repeat the same issue format as Section 1.

## Section 3: Tests

Repeat the same issue format as Section 1.

## Section 4: Performance

Repeat the same issue format as Section 1.

## Final Alignment Before Coding

- [ ] User confirmed selected options
- [ ] Scope and timeline clarified
- [ ] Proposal and PR plan updated
