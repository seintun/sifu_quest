# Memory Files — Schema Reference

These files are Claude's long-term memory for your workspace. They are **gitignored by default** — they accumulate your personal job search data and are not meant to be shared.

---

## File Reference

| File | What it tracks | Updated when |
|---|---|---|
| `profile.md` | Name, career goals, target roles/companies, timeline, learning style, strengths, gaps | Any session where your situation or preferences change |
| `progress.md` | What's mastered, in progress, suggested next focus across all domains | End of every substantive session |
| `dsa-patterns.md` | Pattern mastery table, problem history, hint calibration notes | After every DSA/LeetCode session |
| `job-search.md` | Applications, interview stages, company research, decisions made | Job search sessions |
| `system-design.md` | Concepts covered, gaps identified, key discussions | System design sessions |
| `ideas.md` | Business/startup ideas explored, validation thinking | Business ideas sessions |
| `corrections.md` | Mistakes Claude made + corrections applied | Immediately when a correction is made |

---

## How Claude Updates Them

Claude updates memory files at the end of each substantive session without being asked. You can also trigger an update explicitly: "Update my progress file to reflect what we covered today."

---

## Manual Editing

Edit any file directly at any time. Claude reads them fresh at the start of each session, so changes take effect immediately. If you want to reset a file to its blank template state, delete the file and re-run `/start`.

---

## Resetting

To fully reset your workspace (e.g., situation changed, starting fresh):
1. Delete all files in `memory/` except this README
2. Run `/start` in Claude Code
3. Answer the onboarding questions — Claude will write fresh files
