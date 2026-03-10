export const MAX_FULL_NAME_LENGTH = 80

export function normalizeFullName(input: string): string {
  return input.trim().replace(/\s+/g, ' ')
}

export function validateFullName(input: string): { ok: true; value: string } | { ok: false; error: string } {
  const normalized = normalizeFullName(input)

  if (!normalized) {
    return { ok: false, error: 'Full name is required.' }
  }

  if (normalized.length > MAX_FULL_NAME_LENGTH) {
    return { ok: false, error: `Full name must be ${MAX_FULL_NAME_LENGTH} characters or fewer.` }
  }

  return { ok: true, value: normalized }
}

export function updateProfileNameInMarkdown(content: string, fullName: string): string {
  const line = `- **Name:** ${fullName}`

  if (!content || !content.trim()) {
    return `# User Profile\n\n## Career Context & Goals\n\n${line}\n`
  }

  if (/^- \*\*Name:\*\*.*$/m.test(content)) {
    return content.replace(/^- \*\*Name:\*\*.*$/m, line)
  }

  const sectionHeader = /^(##\s+Career Context & Goals[^\n]*)$/m
  if (sectionHeader.test(content)) {
    return content.replace(sectionHeader, `$1\n\n${line}`)
  }

  return `${content.trimEnd()}\n\n## Career Context & Goals\n\n${line}\n`
}
