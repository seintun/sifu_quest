const DEFAULT_MEMORY_FILE_ORDER = [
  'profile.md',
  'progress.md',
  'dsa-patterns.md',
  'system-design.md',
  'ideas.md',
  'corrections.md',
] as const

export function sortMemoryFiles(
  files: string[],
  orderedPriority: readonly string[] = DEFAULT_MEMORY_FILE_ORDER,
): string[] {
  const uniqueFiles = [...new Set(files.filter(Boolean))]

  return uniqueFiles.sort((a, b) => {
    const aIndex = orderedPriority.indexOf(a)
    const bIndex = orderedPriority.indexOf(b)
    const aPriority = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex
    const bPriority = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex

    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }

    return a.localeCompare(b)
  })
}

export function selectInitialFile(files: string[], preferredFile: string | null | undefined): string {
  if (preferredFile && files.includes(preferredFile)) {
    return preferredFile
  }

  return files[0] ?? ''
}

export function shouldShowError({
  error,
  loading,
  files,
  selectedFile,
}: {
  error: string | null
  loading: boolean
  files: string[]
  selectedFile: string
}): boolean {
  if (!error || loading) {
    return false
  }

  if (files.length === 0) {
    return true
  }

  return Boolean(selectedFile)
}

export function toMemoryErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === 'string' && error.trim()) {
    return error
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallbackMessage
}

export { DEFAULT_MEMORY_FILE_ORDER }
