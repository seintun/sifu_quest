import { NextRequest, NextResponse } from 'next/server'
import { writeMemoryFile } from '@/lib/memory'

export const runtime = 'nodejs'

interface OnboardingData {
  name: string
  situation: string
  targetRoles: string
  language: string
  targetCompanies: string
  timeline: string
  strengths: string
  weaknesses: string
}

export async function POST(request: NextRequest) {
  try {
    const data: OnboardingData = await request.json()

    const profileContent = `# User Profile

> Auto-maintained by Claude. Updated after substantive sessions.

---

## Career Context & Goals

- **Name:** ${data.name}
- **Focus:** ${data.situation}
- **Target roles:** ${data.targetRoles}
- **Interview language:** ${data.language}
- **Target companies:** ${data.targetCompanies}
- **Timeline:** ${data.timeline}

---

## Strengths

${data.strengths.split(',').map(s => `- ${s.trim()}`).join('\n')}

---

## Knowledge Gaps

${data.weaknesses.split(',').map(s => `- ${s.trim()}`).join('\n')}

---

## Learning Style

- Prefers: thinking out loud together, collaborative exploration
- Hints before full answers

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

    await Promise.all([
      writeMemoryFile('profile.md', profileContent),
      writeMemoryFile('progress.md', progressContent),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
