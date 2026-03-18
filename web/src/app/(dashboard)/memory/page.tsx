'use client'

import { createDashboardMarkdownComponents } from '@/components/markdown/dashboard-markdown-components'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  selectInitialFile,
  shouldShowError,
  sortMemoryFiles,
  toMemoryErrorMessage,
} from '@/lib/memory-view'
import { cn } from '@/lib/utils'
import { normalizeMarkdownContent } from '@/lib/markdown-formatting'
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
import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
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

function MobileFileSwitcher({
  files,
  selectedFile,
  onSelect,
}: {
  files: string[]
  selectedFile: string
  onSelect: (file: string) => void
}) {
  if (files.length === 0) {
    return (
      <div
        data-testid="memory-mobile-file-switcher"
        className="flex h-10 flex-1 items-center rounded-lg border border-border/60 px-3 text-xs text-foreground/70"
      >
        No files yet
      </div>
    )
  }

  return (
    <div
      data-testid="memory-mobile-file-switcher"
      className="flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="inline-flex min-w-full gap-1.5 pr-2">
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
                'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                isActive
                  ? `border-border bg-surface ${meta.color}`
                  : 'border-border/50 text-foreground/75 hover:border-border hover:text-foreground',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? meta.color : '')} />
              <span className="max-w-24 truncate">{meta.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function MemoryPage() {
  const { data: dirData, error: dirError, mutate: mutateDir } = useSWR('/api/memory', fetcher)
  
  const files: string[] = useMemo(() => {
    if (!dirData?.files || !Array.isArray(dirData.files)) return []
    const incoming: string[] = dirData.files
    return sortMemoryFiles(incoming.filter((f: string) => f !== 'plan.md'))
  }, [dirData])
  
  const listError = dirError ? toMemoryErrorMessage(dirError, 'Unable to load memory files right now.') : (dirData?.error ? dirData.error : null)

  const [selectedFile, setSelectedFile] = useState('')

  const { data: contentData, error: fetchContentError, isValidating: loading, mutate: mutateContent } = useSWR(selectedFile ? `/api/memory?file=${encodeURIComponent(selectedFile)}` : null, fetcher)
  
  const content = typeof contentData?.content === 'string' ? contentData.content : ''
  const normalizedContent = useMemo(() => normalizeMarkdownContent(content), [content])
  const contentError = fetchContentError ? toMemoryErrorMessage(fetchContentError, 'Unable to load this memory file.') : (contentData?.error ? contentData.error : null)

  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      const preferredFile = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('file') : null
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial file selection
      setSelectedFile(selectInitialFile(files, preferredFile))
    }
  }, [files, selectedFile])



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
  const isCurrentFileCached = selectedFile ? !!contentData : false
  const activeError = listError || contentError
  const showError = shouldShowError({
    error: activeError,
    loading,
    files,
    selectedFile,
  })

  const refreshSelectedFile = useCallback(() => {
    if (selectedFile) mutateContent()
  }, [selectedFile, mutateContent])

  const retry = useCallback(() => {
    if (listError) {
      void mutateDir()
      return
    }

    if (selectedFile) {
      void mutateContent()
    }
  }, [listError, mutateDir, selectedFile, mutateContent])

  const handleSelectFile = useCallback((file: string) => {
    setSelectedFile(file)
  }, [setSelectedFile])

  return (
    <div data-testid="memory-shell" className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <div className="mb-2 flex items-end justify-between gap-2 md:mb-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Memory</h1>
          <p className="mt-0.5 text-[13px] text-foreground/75 md:mt-1 md:text-sm md:text-muted-foreground">
            Read-only view of your workspace files
          </p>
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

      <div className="sticky top-12 z-20 -mx-3 mb-2 border-y border-border/60 bg-background/95 px-3 py-2 backdrop-blur md:hidden">
        <div data-testid="memory-mobile-controls" className="flex items-center gap-2">
          <MobileFileSwitcher files={files} selectedFile={selectedFile} onSelect={handleSelectFile} />

          <Button
            size="sm"
            type="button"
            variant="ghost"
            className="h-10 w-10 shrink-0 px-0"
            onClick={refreshSelectedFile}
            disabled={!selectedFile || loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading ? 'animate-spin' : '')} />
            <span className="sr-only">Refresh current file</span>
          </Button>
        </div>
        <div className="mt-1.5 px-0.5 text-[11px] text-foreground/70">
          {selectedFile ? `${meta.label} • ${lineCount} lines • ${sectionCount} sections` : 'Select a memory file to read'}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 gap-4">
        <div className="hidden w-56 shrink-0 overflow-y-auto py-1 md:block">
          {(!files.length && !listError) ? (
            <p className="text-sm text-muted-foreground">No memory files are available yet.</p>
          ) : (!files.length && listError) ? (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {toMemoryErrorMessage(listError, 'Unable to load memory files right now.')}
            </p>
          ) : !files.length ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2.5 bg-muted/20" />
              ))}
            </div>
          ) : (
            <FileList
              files={files}
              selectedFile={selectedFile}
              onSelect={handleSelectFile}
            />
          )}
        </div>

        <Card className="-mx-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 bg-surface ring-0 md:mx-0 md:rounded-xl md:border-border md:ring-1">
          {selectedFile && (
            <CardHeader className="hidden shrink-0 border-b border-border/30 px-4 pt-3 pb-0 sm:px-5 md:block">
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
            <div className="max-w-none px-3 py-3 sm:px-4 sm:py-4 md:max-w-3xl md:px-5 md:py-5">
              {(loading && !content) ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-8 w-1/3 bg-muted rounded-md mb-6" />
                  <div className="h-4 w-11/12 rounded bg-muted/40" />
                  <div className="h-4 w-10/12 rounded bg-muted/40" />
                  <div className="h-4 w-8/12 rounded bg-muted/40" />
                  <div className="h-4 w-9/12 rounded bg-muted/40" />
                  <div className="h-10 w-full mt-6 rounded-md bg-muted/20" />
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
                  {normalizedContent}
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
