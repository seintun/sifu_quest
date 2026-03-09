import { createClient } from './supabase'

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

// Memory files are scoped to a user and read from the Supabase DB
export async function readMemoryFile(userId: string, filename: string): Promise<string> {
  validateMemoryFile(filename)
  
  const supabase = await createClient()
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

// Mode files are static assets bundled with the app (not user-scoped)
export async function readModeFile(filename: string): Promise<string> {
  validateModeFile(filename)
  
  try {
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')
    
    const filePath = join(process.cwd(), 'src', 'modes', filename)
    const content = await readFile(filePath, 'utf-8')
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
  changeSource: string = 'manual'
): Promise<void> {
  validateMemoryFile(filename)
  
  const supabase = await createClient()
  
  // We use Supabase RPC or upsert to bump the version, but the easiest Upsert is:
  // 1. Get current version
  // 2. Upsert with version + 1
  
  const { data: currentRecord } = await supabase
    .from('memory_files')
    .select('version')
    .eq('user_id', userId)
    .eq('filename', filename)
    .single()
    
  const nextVersion = (currentRecord?.version || 0) + 1

  const { error } = await supabase
    .from('memory_files')
    .upsert({
      user_id: userId,
      filename: filename,
      content: content,
      version: nextVersion,
      updated_at: new Date().toISOString()
    }, { 
      onConflict: 'user_id,filename' 
    })

  if (error) {
    console.error(`Error writing memory file ${filename}:`, error)
    throw new Error(`Failed to save ${filename}`)
  }

  // The database trigger 'snapshot_memory_version' will automatically record 
  // the audit trail row into memory_file_versions. But since we need to pass
  // the changeSource to the trigger via TG_ARGV (which isn't easy via REST), 
  // we'll manually insert the audit row here instead of relying solely on the DB trigger for now.
  
  await supabase
    .from('memory_file_versions')
    .insert({
      user_id: userId,
      filename: filename,
      content: content,
      version: nextVersion,
      change_source: changeSource
    })
}

export function getAllowedMemoryFiles(): string[] {
  return [...ALLOWED_MEMORY_FILES]
}

export function getAllowedModeFiles(): string[] {
  return [...ALLOWED_MODE_FILES]
}

export async function listMemoryFiles(userId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('memory_files')
    .select('filename')
    .eq('user_id', userId)

  return (data || []).map(row => row.filename)
}
