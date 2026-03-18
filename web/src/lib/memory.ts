import { createAdminClient } from './supabase-admin'

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

const modeFileCache = new Map<string, string>()

export class MemoryWriteError extends Error {
  filename: string
  dbCode?: string
  dbMessage?: string

  constructor(filename: string, dbCode?: string, dbMessage?: string) {
    const suffix = [dbCode ? `code=${dbCode}` : null, dbMessage ? `message=${dbMessage}` : null]
      .filter(Boolean)
      .join(' ')
    super(suffix ? `Failed to save ${filename} (${suffix})` : `Failed to save ${filename}`)
    this.name = 'MemoryWriteError'
    this.filename = filename
    this.dbCode = dbCode
    this.dbMessage = dbMessage
  }
}

export interface MemoryBatchEntry {
  filename: string
  content: string
}

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

// Memory files are scoped to a user and read from the Supabase DB
export async function readMemoryFile(userId: string, filename: string): Promise<string> {
  validateMemoryFile(filename)
  
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('memory_files')
    .select('content')
    .eq('user_id', userId)
    .eq('filename', filename)
    .single()

  if (error || !data) {
    return ''
  }
  return data.content || ''
}

export async function readMemoryFiles(
  userId: string,
  filenames: string[],
): Promise<Record<string, string>> {
  for (const filename of filenames) {
    validateMemoryFile(filename)
  }

  if (filenames.length === 0) {
    return {}
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('memory_files')
    .select('filename, content')
    .eq('user_id', userId)
    .in('filename', filenames)

  if (error || !data) {
    return Object.fromEntries(filenames.map((filename) => [filename, '']))
  }

  const byFilename: Record<string, string> = Object.fromEntries(
    filenames.map((filename) => [filename, '']),
  )

  for (const row of data) {
    byFilename[row.filename] = row.content || ''
  }

  return byFilename
}

// Mode files are static assets bundled with the app (not user-scoped)
export async function readModeFile(filename: string): Promise<string> {
  validateModeFile(filename)
  const cached = modeFileCache.get(filename)
  if (cached !== undefined) {
    return cached
  }
  
  try {
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')
    
    const filePath = join(process.cwd(), 'src', 'modes', filename)
    const content = await readFile(filePath, 'utf-8')
    modeFileCache.set(filename, content)
    return content
  } catch (error) {
    console.warn(`Failed to read mode file matching ${filename}:`, error)
    return ''
  }
}

export async function writeMemoryFile(
  userId: string,
  filename: string,
  content: string,
  changeSource: string = 'manual',
): Promise<void> {
  validateMemoryFile(filename)

  const supabase = createAdminClient()

  // Use RPC for atomic version bump to avoid read-then-write race condition.
  // If the RPC doesn't exist (legacy deployment), fall back to a retry-based approach.
  const { error: rpcError } = await supabase.rpc('upsert_memory_file_atomic', {
    user_id_param: userId,
    filename_param: filename,
    content_param: content,
    change_source_param: changeSource,
  })

  if (!rpcError) {
    return
  }

  // If RPC function doesn't exist, use optimistic retry on conflict (read-then-write with version check)
  const missingRpc =
    rpcError.code === '42883' ||
    rpcError.code === 'PGRST202' ||
    (rpcError.message ?? '').includes('upsert_memory_file_atomic')

  if (!missingRpc) {
    console.error(`Error writing memory file ${filename}:`, rpcError)
    throw new MemoryWriteError(filename, rpcError.code, rpcError.message)
  }

  // Fallback: retry up to 3 times to handle concurrent writes
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: currentRecord } = await supabase
      .from('memory_files')
      .select('version')
      .eq('user_id', userId)
      .eq('filename', filename)
      .single()

    const nextVersion = (currentRecord?.version || 0) + 1

    const { error } = await supabase
      .from('memory_files')
      .upsert(
        {
          user_id: userId,
          filename: filename,
          content: content,
          version: nextVersion,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,filename',
        },
      )

    if (!error) {
      await supabase.from('memory_file_versions').insert({
        user_id: userId,
        filename: filename,
        content: content,
        version: nextVersion,
        change_source: changeSource,
      })
      return
    }

    // If it's a unique constraint violation (concurrent write won), retry
    if (error.code === '23505' || attempt === 2) {
      if (attempt === 2) {
        console.error(`Error writing memory file ${filename} after ${attempt + 1} attempts:`, error)
        throw new MemoryWriteError(filename, error.code, error.message)
      }
      // Small delay before retry
      await new Promise((resolve) => setTimeout(resolve, 50))
      continue
    }

    console.error(`Error writing memory file ${filename}:`, error)
    throw new MemoryWriteError(filename, error.code, error.message)
  }
}

export async function writeMemoryFilesBatch(
  userId: string,
  entries: MemoryBatchEntry[],
  changeSource: string = 'manual',
): Promise<void> {
  if (entries.length === 0) {
    return
  }

  for (const entry of entries) {
    validateMemoryFile(entry.filename)
  }

  const supabase = createAdminClient()
  const payload = entries.map((entry) => ({
    filename: entry.filename,
    content: entry.content,
  }))

  const { error } = await supabase.rpc('bulk_upsert_memory_files', {
    user_id_param: userId,
    entries_param: payload,
    change_source_param: changeSource,
  })

  if (!error) {
    return
  }

  const missingRpc =
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    (error.message ?? '').includes('bulk_upsert_memory_files')

  if (missingRpc) {
    await Promise.all(
      entries.map((entry) => writeMemoryFile(userId, entry.filename, entry.content, changeSource)),
    )
    return
  }

  throw new MemoryWriteError('batch', error.code, error.message)
}

export function getAllowedMemoryFiles(): string[] {
  return [...ALLOWED_MEMORY_FILES]
}

export function getAllowedModeFiles(): string[] {
  return [...ALLOWED_MODE_FILES]
}

export async function listMemoryFiles(userId: string): Promise<string[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('memory_files')
    .select('filename')
    .eq('user_id', userId)

  return (data || []).map(row => row.filename)
}
