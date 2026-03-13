import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parsePlan, togglePlanItem } from './plan-parser.ts'

const COMPLEX_PLAN = `# Master Interview Plan 🎯

> **Profile:** Senior Dev | React Specialist | 8 YOE
> **North Star:** Google L6
> **Timeline:** 6 Months

| Metric | Goal | Priority |
| :--- | :--- | :--- |
| DSA | 200 Solved | High |
| System Design | 20 Deep-dives | High |

---

## Month 1 — Foundations
> **Theme:** Build a strong core of DSA and basic system design.

### Month 1 Goals
- [ ] Complete 50 Easy LeetCode problems
- [x] Review Big O notation basics
- Set up a study tracker

### Week 1 — Setup
**Core DSA**
- [ ] Array and String basics
- Solve 5 problems on HashMaps
- [ ] Week 1: Diagnostic test

---

## Month 2 — Deep Dives
> **Theme:** Focus on Hard problems and complex systems.

### Month 2 Goals
- [ ] Solve 50 Medium problems
- [ ] Review distributed caches

---

## Red Flags
| Symptom | Fix |
| :--- | :--- |
| Stalling on Easy problems | Review foundation patterns |
| Skipping mocks | Book a session immediately |

## Immediate Next Steps
- [ ] Buy a notebook
- [x] Register for LeetCode
- Order "Cracking the Coding Interview"

---
`

describe('plan-parser comprehensive suite', () => {
  describe('parsePlan', () => {
    const plan = parsePlan(COMPLEX_PLAN)

    it('should parse the title correctly', () => {
      assert.strictEqual(plan.title, 'Master Interview Plan 🎯')
    })

    it('should parse metadata correctly, including piped values', () => {
      assert.strictEqual(plan.metadata.length, 3)
      assert.deepStrictEqual(plan.metadata[0], { key: 'Profile', value: 'Senior Dev | React Specialist | 8 YOE' })
      assert.deepStrictEqual(plan.metadata[1], { key: 'North Star', value: 'Google L6' })
      assert.deepStrictEqual(plan.metadata[2], { key: 'Timeline', value: '6 Months' })
    })

    it('should parse the dashboard table correctly', () => {
      assert.deepStrictEqual(plan.dashboard.headers, ['Metric', 'Goal', 'Priority'])
      assert.strictEqual(plan.dashboard.rows.length, 2)
      assert.strictEqual(plan.dashboard.rows[0]['Metric'], 'DSA')
      assert.strictEqual(plan.dashboard.rows[1]['Metric'], 'System Design')
    })

    it('should parse multiple months, titles, and themes', () => {
      assert.strictEqual(plan.months.length, 2)
      
      assert.strictEqual(plan.months[0].month, 1)
      assert.strictEqual(plan.months[0].title, 'Foundations')
      assert.strictEqual(plan.months[0].theme, 'Build a strong core of DSA and basic system design.')
      
      assert.strictEqual(plan.months[1].month, 2)
      assert.strictEqual(plan.months[1].title, 'Deep Dives')
      assert.strictEqual(plan.months[1].theme, 'Focus on Hard problems and complex systems.')
    })

    it('should parse categories correctly across months', () => {
      assert.ok(plan.months[0].categories['Month 1 Goals'])
      assert.ok(plan.months[1].categories['Month 2 Goals'])
    })

    it('should parse items with various formats correctly', () => {
      const goals = plan.months[0].categories['Month 1 Goals']
      const week1 = plan.months[0].categories['Week 1 — Setup']

      // Checklist item
      assert.strictEqual(goals[0].text, 'Complete 50 Easy LeetCode problems')
      assert.strictEqual(goals[0].checked, false)
      
      // Checked item
      assert.strictEqual(goals[1].text, 'Review Big O notation basics')
      assert.strictEqual(goals[1].checked, true)

      // Regular list item (parsed as unchecked)
      assert.strictEqual(goals[2].text, 'Set up a study tracker')
      assert.strictEqual(goals[2].checked, false)

      // Bold info item
      const infoItem = week1[0]
      assert.strictEqual(infoItem.text, '**Core DSA**')
      assert.strictEqual(infoItem.checked, false)
      assert.ok(infoItem.id.includes('-info-'))

      // Week extraction
      const diagTest = week1[3]
      assert.strictEqual(diagTest.text, 'Week 1: Diagnostic test')
      assert.strictEqual(diagTest.week, 1)
    })

    it('should parse red flags table correctly', () => {
      assert.strictEqual(plan.redFlags.length, 2)
      assert.strictEqual(plan.redFlags[0].symptom, 'Stalling on Easy problems')
      assert.strictEqual(plan.redFlags[1].symptom, 'Skipping mocks')
    })

    it('should parse immediate next steps correctly', () => {
      assert.strictEqual(plan.immediateSteps.length, 3)
      assert.strictEqual(plan.immediateSteps[0].text, 'Buy a notebook')
      assert.strictEqual(plan.immediateSteps[1].checked, true)
      assert.strictEqual(plan.immediateSteps[2].text, 'Order "Cracking the Coding Interview"')
    })
  })

  describe('togglePlanItem', () => {
    it('should toggle from [ ] to [x]', () => {
      const plan = parsePlan(COMPLEX_PLAN)
      const target = plan.months[0].categories['Month 1 Goals'][0]
      const updated = togglePlanItem(COMPLEX_PLAN, target.id, true)
      assert.ok(updated.includes('- [x] Complete 50 Easy LeetCode problems'))
    })

    it('should toggle from [x] to [ ]', () => {
      const plan = parsePlan(COMPLEX_PLAN)
      const target = plan.months[0].categories['Month 1 Goals'][1]
      const updated = togglePlanItem(COMPLEX_PLAN, target.id, false)
      assert.ok(updated.includes('- [ ] Review Big O notation basics'))
    })

    it('should convert regular bullet to [x]', () => {
      const plan = parsePlan(COMPLEX_PLAN)
      const target = plan.months[0].categories['Month 1 Goals'][2]
      const updated = togglePlanItem(COMPLEX_PLAN, target.id, true)
      assert.ok(updated.includes('- [x] Set up a study tracker'))
    })

    it('should convert regular bullet to [ ]', () => {
      const plan = parsePlan(COMPLEX_PLAN)
      const target = plan.months[0].categories['Week 1 — Setup'][2] // 'Solve 5 problems on HashMaps'
      const updated = togglePlanItem(COMPLEX_PLAN, target.id, false)
      assert.ok(updated.includes('- [ ] Solve 5 problems on HashMaps'))
    })
  })
})
