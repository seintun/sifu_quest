# Sifu Quest — Your Path to Mastery

An AI-powered job search and interview prep workspace built on top of Claude Code. Clone it, run `/start`, and you have a personalized coaching system that remembers your strengths, tracks your progress, and adapts to how you learn.

---

## What Is This?

A structured Claude Code workspace that turns Claude into your dedicated interview prep partner. It supports:

- **DSA coaching** — Socratic hints-first approach, pattern tracking, calibrated scaffolding
- **Mock interviews** — Behavioral (STAR), system design, and technical rounds
- **System design** — Whiteboarding partner with trade-off analysis
- **Job search management** — Application tracking, company research, fit analysis
- **Resume review** — Bullet rewrites, impact framing, tailoring to specific JDs
- **Business ideas** — Brainstorming and validation thinking

Claude reads your profile and memory files at the start of each session, so it always knows where you left off.

---

## Prerequisites

- [Claude Code](https://docs.anthropic.com/claude-code) installed (`npm install -g @anthropic-ai/claude-code`)
- A Claude subscription (Pro or higher recommended)

---

## Quick Setup

```bash
# 1. Clone the repo
git clone https://github.com/seintun/sifu-quest.git
cd sifu-quest

# 2. Open Claude Code
claude

# 3. Run the onboarding command
/start
```

That's it. The `/start` command interviews you, then writes your personal profile into the memory files. From that point on, every session is context-aware.

---

## How It Works

### Directory Structure

```
sifu-quest/
├── CLAUDE.md                    # Master instructions for Claude (routing, rules)
├── modes/                       # Mode-specific coaching prompts
│   ├── dsa.md                   # DSA/LeetCode coaching rules
│   ├── interview-prep.md        # Mock interview framework
│   ├── system-design.md         # System design coaching
│   ├── job-search.md            # Job search strategy
│   └── business-ideas.md        # Idea brainstorming
├── .claude/
│   ├── agents/                  # Subagents for one-shot tasks
│   │   ├── resume-reviewer.md
│   │   ├── job-fit-analyzer.md
│   │   └── problem-generator.md
│   └── commands/
│       └── start.md             # /start onboarding command
└── memory/                      # Your personal data (gitignored)
    ├── README.md                # Memory schema reference
    ├── profile.md               # Who you are + career goals
    ├── progress.md              # What's mastered, in progress, next
    ├── dsa-patterns.md          # Pattern mastery tracking
    ├── job-search.md            # Applications + decisions
    ├── system-design.md         # Concepts covered
    ├── ideas.md                 # Business ideas explored
    └── corrections.md           # Claude's mistakes + fixes
```

### Session Modes

Say any of these to Claude at the start of a session:

| What you say | What Claude activates |
|---|---|
| "Let's do DSA" / "LeetCode practice" | DSA coaching mode — hints-first, pattern tracking |
| "Mock interview" / "Behavioral prep" | Interview prep mode — STAR method, question bank |
| "System design" / "Let's design X" | System design mode — whiteboarding partner |
| "Job search" / "Application help" | Job search mode — tracking, research, strategy |
| "Business idea" / "Startup thinking" | Business ideas mode — brainstorming, validation |

Claude reads the relevant mode file + your memory files automatically.

### Subagents (Auto-Triggered)

These fire automatically when you use the right phrases — no manual activation needed:

| Agent | Trigger phrases |
|---|---|
| **resume-reviewer** | "review this bullet", "improve my resume", "rewrite this for [company]" |
| **job-fit-analyzer** | "does this job fit me", "analyze this JD", sharing a job URL |
| **problem-generator** | "give me a problem", "what should I practice", "quiz me" |

### Memory System (Self-Learning Loop)

After each substantive session, Claude updates the relevant memory files:

- Your **profile** is updated when career goals or learning preferences change
- **DSA patterns** are updated after every problem (mastery level, problem history)
- **Progress** is updated to reflect what's been covered and what's next
- **Job search** is updated with new applications, decisions, or company research
- **Corrections** logs any mistakes Claude made so it doesn't repeat them

You can also edit memory files manually at any time — Claude treats them as ground truth.

---

## Your First Session

After cloning, run `/start` in Claude Code. Claude will ask you a series of questions one at a time and write your profile automatically.

If you prefer to seed it manually, paste this into Claude Code:

```
Please initialize my workspace. Read memory/profile.md to see the template fields,
then ask me the following questions one at a time (wait for my answer before continuing):
1. What's your name or what should I call you?
2. What's your current situation? (employed + job hunting, laid off, new grad, career switcher, etc.)
3. What roles are you targeting? (e.g., senior frontend, full-stack, backend, staff+)
4. What's your primary programming language? Is that also what you want to use for DSA/LeetCode?
5. What companies or company tiers are you targeting? (e.g., FAANG, Series B startups, fintech)
6. What's your rough timeline? (actively interviewing, 3 months out, just exploring)
7. What are 2-3 of your strongest technical areas?
8. What are 1-2 areas that need work before interviews?

After I answer all questions, write a fully populated memory/profile.md and an initial
memory/progress.md. Then summarize my profile and suggest a first action.
```

---

## Customizing

### Adding a new mode

1. Create `modes/your-mode.md` with coaching rules for that domain
2. Add a row to the Session Routing table in `CLAUDE.md`
3. Add a corresponding memory file if you want persistence

### Editing agent behavior

Open `.claude/agents/<agent-name>.md` and modify the system prompt. Agents are stateless — they receive the current conversation context and return a result.

### Extending memory schema

Add new fields to any `memory/*.md` file. Claude will pick them up automatically since it reads the full file contents. Document new fields in `memory/README.md`.

---

## Tips for Best Results

- **Start each session with context**: "I'm continuing DSA from yesterday, I was on binary search" — Claude loads memory but a quick framing helps
- **Use the hint ladder**: In DSA mode, resist asking for the answer. The hints-first approach builds real retention
- **Log corrections in the moment**: If Claude gets something wrong, say "that's incorrect — [correction]" and it will update `memory/corrections.md`
- **Re-run `/start` if your situation changes**: Got a new job offer? Changed target companies? Re-run `/start` to update your profile
- **Memory files are yours**: They're gitignored by default. Edit them directly anytime to correct or add context

---

## License

MIT — clone, fork, adapt freely.
