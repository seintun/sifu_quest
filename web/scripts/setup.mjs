#!/usr/bin/env node
/**
 * Claude Thinking Buddy — First-time setup script
 *
 * Handles:
 *   1. Creating web/.env.local (prompts for API key, memory dir)
 *   2. Initializing the external memory git repo
 *   3. Running a Claude-powered interview to learn about the user
 *   4. Writing personalized profile.md and progress.md
 *
 * Run: ./setup  (from repo root)
 *   or: cd web && npm run setup
 */

import { createInterface } from 'readline/promises'
import { stdin as input, stdout as output } from 'process'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_DIR = path.resolve(__dirname, '..')
const ROOT_DIR = path.resolve(WEB_DIR, '..')
const ENV_PATH = path.join(WEB_DIR, '.env.local')

// ── ANSI colors ────────────────────────────────────────────────────────────────
const R = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BLUE = '\x1b[34m'

const c = (text, ...codes) => codes.join('') + text + R

// ── Env file helpers ───────────────────────────────────────────────────────────
function parseEnvFile(content) {
  const vars = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return vars
}

function serializeEnvFile(vars) {
  return Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const rl = createInterface({ input, output })

  console.log()
  console.log(c('  Claude Thinking Buddy', BOLD, CYAN) + c(' — Workspace Setup', DIM))
  console.log(c('  ──────────────────────────────────────', DIM))
  console.log()

  // ── Phase 1: web/.env.local ──────────────────────────────────────────────────

  let envVars = {}
  try {
    envVars = parseEnvFile(await fs.readFile(ENV_PATH, 'utf-8'))
  } catch {
    // file doesn't exist yet — that's fine
  }

  // API key
  if (!envVars.ANTHROPIC_API_KEY) {
    console.log(c('  No ANTHROPIC_API_KEY found in web/.env.local.', YELLOW))
    const apiKey = await rl.question(c('  Enter your Anthropic API key: ', BOLD))
    if (!apiKey.trim()) {
      console.log(c('\n  API key is required. Exiting.\n', YELLOW))
      rl.close()
      process.exit(1)
    }
    envVars.ANTHROPIC_API_KEY = apiKey.trim()
    console.log()
  }

  // Memory dir
  const defaultMemoryDir = path.join(os.homedir(), '.claude-memory/claude_thinking_buddy')
  if (!envVars.MEMORY_DIR) {
    console.log(c(`  Default memory location: ${defaultMemoryDir}`, DIM))
    const custom = await rl.question(c('  Press Enter to accept, or type a custom path: ', BOLD))
    envVars.MEMORY_DIR = custom.trim() || defaultMemoryDir
    console.log()
  }

  if (!envVars.MODES_DIR) {
    envVars.MODES_DIR = '../modes'
  }

  await fs.writeFile(ENV_PATH, serializeEnvFile(envVars), 'utf-8')
  console.log(c('  ✓ web/.env.local ready', GREEN))
  console.log()

  // Resolve memory dir (absolute path or relative to web/)
  const memoryDir = path.resolve(WEB_DIR, envVars.MEMORY_DIR)
  const profilePath = path.join(memoryDir, 'profile.md')

  // ── Phase 2: Check existing profile ──────────────────────────────────────────

  let profileExists = false
  try {
    await fs.access(profilePath)
    profileExists = true
  } catch {}

  if (profileExists) {
    console.log(c('  A profile already exists at this memory location.', YELLOW))
    const ans = await rl.question(c('  Redo setup and overwrite? [y/N]: ', BOLD))
    if (!ans.trim().toLowerCase().startsWith('y')) {
      console.log(c('\n  Setup skipped. Your profile is unchanged.\n', DIM))
      rl.close()
      process.exit(0)
    }
    console.log()
  }

  // ── Phase 3: Init memory dir + git repo ───────────────────────────────────────

  await fs.mkdir(memoryDir, { recursive: true })

  const gitDir = path.join(memoryDir, '.git')
  try {
    await fs.access(gitDir)
  } catch {
    execSync('git init', { cwd: memoryDir, stdio: 'ignore' })
    execSync('git commit --allow-empty -m "Initialize memory repo"', {
      cwd: memoryDir,
      stdio: 'ignore',
    })
    console.log(c('  ✓ Memory git repo initialized', GREEN))
    console.log()
  }

  // ── Phase 4: Claude interview ─────────────────────────────────────────────────

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: envVars.ANTHROPIC_API_KEY })

  console.log(c("  Let's learn a bit about you so Claude can be a better thinking partner.", DIM))
  console.log(c('  Answer naturally — this should take about 5 minutes.', DIM))
  console.log()

  const INTERVIEW_SYSTEM = `You are conducting a warm, conversational onboarding interview for a personal AI thinking-partner workspace.

Your goal: gather enough information to write a personalized profile that makes future Claude sessions immediately useful.

Rules:
- Ask ONE question at a time. Never bundle multiple questions.
- Be warm and concise. Acknowledge each answer briefly before moving on.
- Cover these topics (in roughly this order, adapting naturally to the conversation):
  1. Name
  2. Current role / years of experience / primary tech stack
  3. Current situation (job searching, leveling up, building something, exploring ideas?)
  4. Primary goal for this workspace (interview prep? system design? startup thinking? general learning?)
  5. Timeline or urgency (interview deadline, project launch, no rush, etc.)
  6. Preferred communication/learning style (think out loud together, hints before answers, terse and direct, etc.)
  7. Preferred coding language for problems (if they mentioned interviews or DSA)
- Skip questions that were already answered naturally in prior responses.
- When you have enough to write a complete profile (typically 6–8 exchanges), wrap up warmly and output this exact token on its own line:
INTERVIEW_COMPLETE`

  const messages = []

  // Kick off
  const kickoff = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 300,
    system: INTERVIEW_SYSTEM,
    messages: [{ role: 'user', content: 'Begin the interview.' }],
  })

  const firstMsg = kickoff.content[0].text.replace('INTERVIEW_COMPLETE', '').trim()
  console.log(c('  Claude: ', BOLD + BLUE) + firstMsg)
  console.log()

  messages.push({ role: 'user', content: 'Begin the interview.' })
  messages.push({ role: 'assistant', content: kickoff.content[0].text })

  // Interview loop
  while (true) {
    const userInput = await rl.question(c('  You: ', BOLD + GREEN))
    if (!userInput.trim()) continue

    messages.push({ role: 'user', content: userInput })

    const resp = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 400,
      system: INTERVIEW_SYSTEM,
      messages,
    })

    const reply = resp.content[0].text
    messages.push({ role: 'assistant', content: reply })

    const done = reply.includes('INTERVIEW_COMPLETE')
    const visibleReply = reply.replace('INTERVIEW_COMPLETE', '').trim()

    if (visibleReply) {
      console.log()
      console.log(c('  Claude: ', BOLD + BLUE) + visibleReply)
      console.log()
    }

    if (done) {
      console.log(c('  Generating your profile...', DIM))
      console.log()
      break
    }
  }

  // ── Phase 5: Generate profile.md + progress.md ────────────────────────────────

  const today = new Date().toISOString().slice(0, 10)

  const conversationText = messages
    .filter(m => m.content !== 'Begin the interview.')
    .map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content}`)
    .join('\n')

  const genPrompt = `Based on this onboarding interview, generate two memory files.

INTERVIEW TRANSCRIPT:
${conversationText}

Output the files using exactly these XML tags (no other text outside the tags):

<profile>
# User Profile

> Auto-maintained by Claude. Updated after substantive sessions.

---

## Career Context & Goals

[Fill from interview: name, current focus, background summary, years of experience, production languages, frameworks/tools, target roles, target companies if mentioned, timeline, interview language preference if mentioned]

---

## Learning Style

[Fill from interview: collaboration preferences, hints-first vs direct answers, pacing, hand-holding level]

---

## Strengths

[Fill from interview: real-world experience, specific tech depth, notable skills]

---

## Knowledge Gaps

[Fill from interview: areas they want to improve, things starting fresh on]

---

## Preferred Communication Style

[Fill from interview: how they like to work with Claude]

---

## Notes

- First session: ${today}
- Workspace initialized via setup script
</profile>

<progress>
# Progress Tracker

> Auto-maintained by Claude. Updated after substantive sessions.

---

## DSA / LeetCode

### Mastered
- (none yet)

### In Progress
- (none yet)

### Suggested Next Focus
[Suggest a concrete starting point based on their goals and experience level]

---

## System Design

### Concepts Covered
- (none yet)

### Suggested Next Focus
[Suggest based on their goals — skip section if not relevant]

### Gaps to Address
[Fill based on what they shared, or note "not a current focus" if irrelevant]

---

## Job Search

### Status
[Fill from interview, or "Not currently a focus" if not mentioned]

### Applications / Targets
- (to be tracked)

---

## Business / Startup Thinking

### Ideas Explored
- (none yet)

---

## Overall Notes
- Workspace initialized: ${today}
- Sessions completed: 0
- Last updated: ${today}
</progress>`

  const genResp = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    system: 'Generate structured markdown memory files. Output ONLY the XML-tagged content — no preamble, no explanation.',
    messages: [{ role: 'user', content: genPrompt }],
  })

  const generated = genResp.content[0].text
  const profileMatch = generated.match(/<profile>([\s\S]*?)<\/profile>/)
  const progressMatch = generated.match(/<progress>([\s\S]*?)<\/progress>/)

  if (!profileMatch || !progressMatch) {
    const debugPath = path.join(ROOT_DIR, 'setup-output.txt')
    await fs.writeFile(debugPath, generated, 'utf-8')
    console.log(c('  Could not parse generated files. Raw output saved to setup-output.txt.', YELLOW))
    rl.close()
    process.exit(1)
  }

  await fs.writeFile(profilePath, profileMatch[1].trim() + '\n', 'utf-8')
  await fs.writeFile(path.join(memoryDir, 'progress.md'), progressMatch[1].trim() + '\n', 'utf-8')

  // ── Phase 6: Done ─────────────────────────────────────────────────────────────

  console.log(c('  ✓ profile.md written', GREEN))
  console.log(c('  ✓ progress.md written', GREEN))
  console.log()
  console.log(c('  Setup complete!', BOLD + GREEN))
  console.log(c(`  Memory location: ${memoryDir}`, DIM))
  console.log(c('  Run ./save-memory anytime to snapshot your memory files.', DIM))
  console.log(c('  Start the app:  cd web && npm run dev', DIM))
  console.log()

  rl.close()
}

main().catch(err => {
  console.error(c('\n  Setup failed: ' + err.message + '\n', YELLOW))
  process.exit(1)
})
