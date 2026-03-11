'use client'

import { createDashboardMarkdownComponents } from '@/components/markdown/dashboard-markdown-components'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  selectInitialFile,
  shouldShowError,
  sortMemoryFiles,
  toMemoryErrorMessage,
} from '@/lib/memory-view'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  ClipboardList,
  Clock,
  Code2,
  FileText,
  Lightbulb,
  Network,
  RefreshCcw,
  TrendingUp,
  User,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const FILE_META: Record<string, { icon: React.ElementType; color: string; accent: string; label: string }> = {
  'profile.md': { icon: User, color: 'text-streak', accent: 'border-streak/30 bg-streak/5', label: 'Profile' },
  'progress.md': { icon: TrendingUp, color: 'text-streak', accent: 'border-streak/30 bg-streak/5', label: 'Progress' },
  'dsa-patterns.md': { icon: Code2, color: 'text-dsa', accent: 'border-dsa/30 bg-dsa/5', label: 'DSA Patterns' },
  'job-search.md': { icon: Briefcase, color: 'text-jobs', accent: 'border-jobs/30 bg-jobs/5', label: 'Job Search' },
  'system-design.md': { icon: Network, color: 'text-design', accent: 'border-design/30 bg-design/5', label: 'System Design' },
  'plan.md': { icon: ClipboardList, color: 'text-plan', accent: 'border-plan/30 bg-plan/5', label: 'Plan' },
  'corrections.md': { icon: AlertCircle, color: 'text-warning', accent: 'border-warning/30 bg-warning/5', label: 'Corrections' },
  'ideas.md': { icon: Lightbulb, color: 'text-coach', accent: 'border-coach/30 bg-coach/5', label: 'Ideas' },
}

function getFileTestId(file: string): string {
  return `memory-file-${file.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase()}`
}

function FileList({
  files,
  selectedFile,
  onSelect,
  className,
}: {
  files: string[]
  selectedFile: string
  onSelect: (file: string) => void
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      {files.map((file) => {
        const meta = FILE_META[file] || { icon: FileText, color: 'text-muted-foreground', accent: '', label: file }
        const Icon = meta.icon
        const isActive = selectedFile === file

        return (
          <button
            key={file}
            type="button"
            data-testid={getFileTestId(file)}
            onClick={() => onSelect(file)}
            className={cn(
              'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all duration-150',
              isActive
                ? `border border-border bg-surface font-medium shadow-md ${meta.color}`
                : 'text-muted-foreground hover:bg-surface/50 hover:text-foreground',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', isActive ? meta.color : '')} />
            <span className="truncate text-sm">{meta.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function MemoryPage() {
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [contentError, setContentError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [fileCache, setFileCache] = useState<Record<string, string>>({})

  const fileCacheRef = useRef<Record<string, string>>({})
  const fileRequestIdRef = useRef(0)

  const updateCache = useCallback((file: string, value: string) => {
    setFileCache((previous) => {
      const next = { ...previous, [file]: value }
      fileCacheRef.current = next
      return next
    })
  }, [])

  const loadFiles = useCallback(async () => {
    try {
      const response = await fetch('/api/memory')
      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Unable to load memory files.')
      }

      const incomingFiles: string[] = Array.isArray(data.files)
        ? data.files.filter((file: unknown): file is string => typeof file === 'string')
        : []
      const filteredFiles = incomingFiles.filter((file) => file !== 'plan.md')
      const orderedFiles = sortMemoryFiles(filteredFiles)

      setFiles(orderedFiles)
      setListError(null)

      setFileCache((previous) => {
        const prunedEntries = orderedFiles
          .filter((file) => previous[file] !== undefined)
          .map((file) => [file, previous[file]] as const)
        const next = Object.fromEntries(prunedEntries)
        fileCacheRef.current = next
        return next
      })

      const preferredFile = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('file')
        : null

      setSelectedFile((current) => {
        if (current && orderedFiles.includes(current)) {
          return current
        }

        return selectInitialFile(orderedFiles, preferredFile)
      })
    } catch (error) {
      setFiles([])
      setSelectedFile('')
      setContent('')
      setListError(toMemoryErrorMessage(error, 'Unable to load memory files right now.'))
    }
  }, [])

  const loadFileContent = useCallback(
    async (file: string, options?: { force?: boolean }) => {
      if (!file) {
        return
      }

      const cached = fileCacheRef.current[file]
      if (cached !== undefined && !options?.force) {
        setContent(cached)
        setLoading(false)
        setContentError(null)
        return
      }

      const requestId = fileRequestIdRef.current + 1
      fileRequestIdRef.current = requestId

      setLoading(true)
      setContentError(null)

      try {
        const response = await fetch(`/api/memory?file=${encodeURIComponent(file)}`)
        const data = await response.json()

        if (!response.ok || data.error) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Unable to load this memory file.')
        }

        const nextContent = typeof data.content === 'string' ? data.content : ''

        if (fileRequestIdRef.current !== requestId) {
          return
        }

        setContent(nextContent)
        updateCache(file, nextContent)
      } catch (error) {
        if (fileRequestIdRef.current !== requestId) {
          return
        }

        setContent('')
        setContentError(toMemoryErrorMessage(error, 'Unable to load this memory file.'))
      } finally {
        if (fileRequestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    [updateCache],
  )

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  useEffect(() => {
    if (!selectedFile) {
      setContent('')
      setContentError(null)
      return
    }

    void loadFileContent(selectedFile)
  }, [selectedFile, loadFileContent])

  useEffect(() => {
    if (!selectedFile || typeof window === 'undefined') {
      return
    }

    const url = new URL(window.location.href)
    if (url.searchParams.get('file') === selectedFile) {
      return
    }

    url.searchParams.set('file', selectedFile)
    const query = url.searchParams.toString()
    window.history.replaceState({}, '', `${url.pathname}${query ? `?${query}` : ''}`)
  }, [selectedFile])

  const meta = FILE_META[selectedFile] || {
    icon: FileText,
    color: 'text-muted-foreground',
    accent: 'border-border bg-elevated/30',
    label: selectedFile,
  }
  const ActiveIcon = meta.icon

  const markdownComponents = useMemo(
    () =>
      createDashboardMarkdownComponents({
        variant: 'memory',
        accentClassName: meta.accent,
      }),
    [meta.accent],
  )

  const lineCount = content ? content.split('\n').length : 0
  const sectionCount = content ? (content.match(/^## /gm) || []).length : 0
  const isCurrentFileCached = selectedFile ? fileCache[selectedFile] !== undefined : false
  const activeError = listError || contentError
  const showError = shouldShowError({
    error: activeError,
    loading,
    files,
    selectedFile,
  })

  const refreshSelectedFile = useCallback(() => {
    if (!selectedFile) {
      return
    }

    void loadFileContent(selectedFile, { force: true })
  }, [selectedFile, loadFileContent])

  const retry = useCallback(() => {
    if (listError) {
      void loadFiles()
      return
    }

    if (selectedFile) {
      void loadFileContent(selectedFile, { force: true })
    }
  }, [listError, loadFiles, selectedFile, loadFileContent])

  const handleSelectFile = useCallback((file: string) => {
    setSelectedFile(file)
    setPickerOpen(false)
  }, [])

  return (
    <div data-testid="memory-shell" className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Memory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Read-only view of your workspace files</p>
        </div>
        {selectedFile && (
          <div className="hidden items-center gap-3 text-xs text-foreground/70 md:flex">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {lineCount} lines
            </span>
            <span>•</span>
            <span>{sectionCount} sections</span>
          </div>
        )}
      </div>

      <div className="sticky top-12 z-20 -mx-3 mb-3 border-y border-border/60 bg-background/95 px-3 py-2 backdrop-blur md:hidden">
        <div data-testid="memory-mobile-controls" className="flex items-center gap-2">
          <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  data-testid="memory-file-picker-trigger"
                  className="inline-flex h-11 min-w-24 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-foreground"
                />
              }
            >
              Files
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70dvh] rounded-t-2xl border-t border-border bg-surface p-0">
              <SheetHeader className="border-b border-border pb-3">
                <SheetTitle>Memory Files</SheetTitle>
              </SheetHeader>
              <div className="h-[calc(70dvh-4.5rem)] overflow-y-auto p-3">
                {files.length > 0 ? (
                  <FileList
                    files={files}
                    selectedFile={selectedFile}
                    onSelect={handleSelectFile}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No memory files are available yet.</p>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{meta.label || 'No file selected'}</p>
            {selectedFile ? (
              <p className="truncate text-xs text-foreground/70">{lineCount} lines • {sectionCount} sections</p>
            ) : (
              <p className="text-xs text-foreground/70">Select a memory file</p>
            )}
          </div>

          <Button
            size="sm"
            type="button"
            variant="ghost"
            className="h-11 px-3"
            onClick={refreshSelectedFile}
            disabled={!selectedFile || loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading ? 'animate-spin' : '')} />
            <span className="sr-only">Refresh current file</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        <div className="hidden w-56 shrink-0 overflow-y-auto py-1 md:block">
          {files.length > 0 ? (
            <FileList
              files={files}
              selectedFile={selectedFile}
              onSelect={handleSelectFile}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No memory files are available yet.</p>
          )}
        </div>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border bg-surface">
          {selectedFile && (
            <CardHeader className="shrink-0 border-b border-border/30 px-4 pt-3 pb-0 sm:px-5">
              <CardTitle className="pb-3 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <ActiveIcon className={cn('h-4 w-4', meta.color)} />
                  <span className={cn('font-display', meta.color)}>{meta.label}</span>
                  {isCurrentFileCached && (
                    <Badge variant="outline" className="hidden border-border/40 text-[10px] text-foreground/70 sm:inline-flex">
                      cached
                    </Badge>
                  )}
                  <Badge variant="outline" className="ml-auto border-border/40 font-mono text-[10px] text-dim">
                    {selectedFile}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
          )}

          <div data-testid="memory-reader" className="memory-prose flex-1 min-h-0 overflow-y-auto">
            <div className="max-w-none px-4 py-4 sm:px-5 sm:py-5 md:max-w-3xl">
              {loading ? (
                <div className="space-y-3">
                  <div className="h-4 w-11/12 animate-pulse rounded bg-elevated/50" />
                  <div className="h-4 w-10/12 animate-pulse rounded bg-elevated/50" />
                  <div className="h-4 w-8/12 animate-pulse rounded bg-elevated/50" />
                  <div className="h-4 w-9/12 animate-pulse rounded bg-elevated/50" />
                </div>
              ) : showError ? (
                <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
                  <p className="font-medium text-danger">Unable to load memory</p>
                  <p className="mt-1 text-foreground/80">{activeError}</p>
                  <Button type="button" variant="outline" className="mt-3 h-10" onClick={retry}>
                    Try again
                  </Button>
                </div>
              ) : content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {content}
                </ReactMarkdown>
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-40" />
                    <p className="text-sm text-foreground/80">
                      {selectedFile ? 'This file does not have content yet' : 'Select a file to view'}
                    </p>
                    <p className="mt-1 text-xs text-foreground/65">Your memory files are read-only</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
