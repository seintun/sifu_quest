import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const getMemoryDir = () => path.resolve(process.cwd(), process.env.MEMORY_DIR || '../memory')
const MODES_DIR = path.resolve(process.cwd(), process.env.MODES_DIR || '../modes')

const ALLOWED_MEMORY_FILES = [
  'profile.md',
  'progress.md',
  'dsa-patterns.md',
  'job-search.md',
  'system-design.md',
  'plan.md',
  'corrections.md',
  'ideas.md',
]

const ALLOWED_MODE_FILES = [
  'dsa.md',
  'interview-prep.md',
  'system-design.md',
  'job-search.md',
  'business-ideas.md',
]

function validateMemoryFile(filename: string): void {
  if (!ALLOWED_MEMORY_FILES.includes(filename)) {
    throw new Error(`File not allowed: ${filename}`)
  }
}

function validateModeFile(filename: string): void {
  if (!ALLOWED_MODE_FILES.includes(filename)) {
    throw new Error(`Mode file not allowed: ${filename}`)
  }
}

export async function readMemoryFile(filename: string): Promise<string> {
  validateMemoryFile(filename)
  const filePath = path.join(getMemoryDir(), filename)
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

export async function readModeFile(filename: string): Promise<string> {
  validateModeFile(filename)
  const filePath = path.join(MODES_DIR, filename)
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

// Simple queue-based write lock to prevent concurrent corruption
const writeLocks = new Map<string, Promise<void>>()

export async function writeMemoryFile(filename: string, content: string): Promise<void> {
  validateMemoryFile(filename)
  const filePath = path.join(getMemoryDir(), filename)

  // Queue writes per file
  const existing = writeLocks.get(filename) || Promise.resolve()
  const writePromise = existing.then(async () => {
    await fs.mkdir(getMemoryDir(), { recursive: true })
    // Atomic write: write to temp file then rename
    const tmpPath = path.join(os.tmpdir(), `memory-${filename}-${Date.now()}`)
    await fs.writeFile(tmpPath, content, 'utf-8')
    await fs.rename(tmpPath, filePath)
  })

  writeLocks.set(filename, writePromise.catch(() => {}))
  await writePromise
}

export function getAllowedMemoryFiles(): string[] {
  return [...ALLOWED_MEMORY_FILES]
}

export function getAllowedModeFiles(): string[] {
  return [...ALLOWED_MODE_FILES]
}

export async function listMemoryFiles(): Promise<string[]> {
  const files: string[] = []
  for (const f of ALLOWED_MEMORY_FILES) {
    try {
      await fs.access(path.join(getMemoryDir(), f))
      files.push(f)
    } catch {
      // file doesn't exist, skip
    }
  }
  return files
}
