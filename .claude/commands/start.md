Initialize or reinitialize this workspace by interviewing the user and writing their personal profile into memory files.

## Instructions

Welcome the user and briefly explain what this workspace is (1-2 sentences max). Then collect their information by asking the questions below **one at a time** — wait for each answer before asking the next. Do not ask multiple questions at once.

### Questions (ask in order, one at a time)

1. "What's your name, or what should I call you?"
2. "What's your current situation? For example: employed and job hunting, recently laid off, new grad, or career switcher."
3. "What kinds of roles are you targeting? For example: senior frontend, full-stack, backend, ML engineer, staff+."
4. "What's your primary programming language? And is that also the language you want to use for DSA/LeetCode practice, or a different one?"
5. "What companies or company tiers are you targeting? For example: FAANG, Series B startups, fintech, or open to anything."
6. "What's your rough timeline? For example: actively interviewing now, about 3 months out, or just exploring."
7. "What are 2 or 3 of your strongest technical areas?"
8. "What are 1 or 2 areas you know need work before interviews?"

### After collecting all answers

1. Write a fully populated `memory/profile.md` replacing all `[PLACEHOLDER]` fields with the user's real answers. Keep the section headers and structure identical to the template — just fill in the values.

2. Write an initial `memory/progress.md` with:
   - Timeline filled in from their answer
   - Workspace initialized date set to today
   - Sessions completed: 0
   - Suggested next focus based on their stated gaps and timeline

3. Print a confirmation message:
   - "Your workspace is set up. Here's a summary of your profile:" followed by a clean summary (not the raw markdown)
   - Then ask: "Want to start with DSA practice, a mock interview, system design, or something else?"

## Notes

- This command is re-runnable. If the user runs `/start` again, re-ask all questions and overwrite `memory/profile.md` and `memory/progress.md` with fresh answers. This is useful when their situation changes (e.g., got an offer, changed target companies, new role).
- Do not skip questions or assume answers from context — ask each one explicitly.
- Keep the tone warm and conversational, not clinical.
