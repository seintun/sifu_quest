import { writeMemoryFile } from '@/lib/memory'
import { getPlanTimelineMeta } from '@/lib/profile-timeline'
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export const runtime = 'nodejs'
export const maxDuration = 60

interface OnboardingData {
  name: string
  situation: string
  experience: string
  techStack: string
  goals: string
  targetRoles: string
  targetCompanies: string
  timeline: string
  hoursPerWeek: string
  language: string
  learningStyle: string
  strengths: string
  weaknesses: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const data: OnboardingData = await request.json()

    const profileContent = `# User Profile

> Auto-maintained by Claude. Updated after substantive sessions.

---

## Career Context & Goals

- **Name:** ${data.name}
- **Situation:** ${data.situation}
- **Experience:** ${data.experience}
- **Tech stack:** ${data.techStack}
- **Goals:** ${data.goals}
- **Target roles:** ${data.targetRoles}
- **Target companies:** ${data.targetCompanies}
- **Timeline:** ${data.timeline}
- **Hours/week:** ${data.hoursPerWeek}
- **Interview language:** ${data.language}

---

## Strengths

${data.strengths.split(',').map(s => `- ${s.trim()}`).join('\n')}

---

## Knowledge Gaps

${data.weaknesses.split(',').map(s => `- ${s.trim()}`).join('\n')}

---

## Learning Style

- ${data.learningStyle}

---

## Notes

- Workspace initialized: ${new Date().toISOString().split('T')[0]}
`

    const progressContent = `# Progress Tracker

> Auto-maintained by Claude. Updated after substantive sessions.

---

## DSA / LeetCode

### Mastered
- (none yet)

### In Progress
- Getting started

### Suggested Next Focus
- Begin with Arrays & Hashing pattern

---

## System Design

### Concepts Covered
- (none yet)

### Suggested Next Focus
- Start with fundamentals: scalability, load balancing, databases

---

## Job Search

### Status
- ${data.situation}

---

## Overall Notes
- Workspace initialized: ${new Date().toISOString().split('T')[0]}
- Sessions completed: 0
`

    const dsaPatternsContent = `# DSA Patterns

> Auto-maintained by Claude.

---

## Mastered
- (none yet)

## In Progress
- Getting started

## Suggested Next
- Arrays & Hashing
`

    const jobSearchContent = `# Job Search

> Auto-maintained by Claude.

---

## Status
- ${data.situation}

## Target Roles
- ${data.targetRoles}

## Target Companies
- ${data.targetCompanies}

## Applications
- (none yet)
`

    const systemDesignContent = `# System Design

> Auto-maintained by Claude.

---

## Concepts Covered
- (none yet)

## Suggested Next
- Fundamentals: scalability, load balancing, databases
`

    const ideasContent = `# Ideas

> Auto-maintained by Claude.

---

## Explored
- (none yet)
`

    const correctionsContent = `# Corrections

> Auto-maintained by Claude.

---

## Log
- (none yet)
`

    const timelineMeta = getPlanTimelineMeta(data.timeline)
    const timelineStructureInstruction = timelineMeta.durationMonths
      ? `Build exactly ${timelineMeta.durationMonths} monthly phases labeled "## Month 1 — ...", "## Month 2 — ...", up to Month ${timelineMeta.durationMonths}.`
      : `Build phased milestones that explicitly align to the stated timeline: "${data.timeline}".`

    // Onboarding generation always uses the app's key since the user hasn't added theirs yet
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const planResponse = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Generate a personalized interview prep game plan in markdown for:
- Name: ${data.name}
- Timeline: ${data.timeline}
- Goals: ${data.goals}
- Experience: ${data.experience}
- Hours/week: ${data.hoursPerWeek}
- Tech stack: ${data.techStack}
- Strengths: ${data.strengths}
- Weaknesses: ${data.weaknesses}

Write a detailed plan with a # title reflecting the timeline, phase breakdowns (months/weeks),
concrete weekly actions for DSA, system design, and job search. Include markdown links to resources.
${timelineStructureInstruction}
Format as clean markdown suitable for rendering.`
      }]
    })
    const planContent = (planResponse.content[0] as { type: 'text'; text: string }).text

    await Promise.all([
      writeMemoryFile(userId, 'profile.md', profileContent, 'onboarding'),
      writeMemoryFile(userId, 'progress.md', progressContent, 'onboarding'),
      writeMemoryFile(userId, 'dsa-patterns.md', dsaPatternsContent, 'onboarding'),
      writeMemoryFile(userId, 'job-search.md', jobSearchContent, 'onboarding'),
      writeMemoryFile(userId, 'system-design.md', systemDesignContent, 'onboarding'),
      writeMemoryFile(userId, 'ideas.md', ideasContent, 'onboarding'),
      writeMemoryFile(userId, 'corrections.md', correctionsContent, 'onboarding'),
      writeMemoryFile(userId, 'plan.md', planContent, 'onboarding'),
    ])

    const { logProgressEvent, logAuditEvent } = await import('@/lib/progress')
    await logProgressEvent(userId, 'onboarding_complete', 'onboarding')
    await logAuditEvent(userId, 'account', 'profile', { action: 'onboarding_completed' })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

