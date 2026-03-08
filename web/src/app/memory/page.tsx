'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  ChevronRight,
  ClipboardList,
  Clock,
  Code2,
  FileText,
  Info,
  Lightbulb,
  Network,
  TrendingUp,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const FILE_META: Record<string, { icon: React.ElementType; color: string; accent: string; label: string }> = {
  'profile.md':       { icon: User,          color: 'text-streak',  accent: 'border-streak/30 bg-streak/5', label: 'Profile' },
  'progress.md':      { icon: TrendingUp,    color: 'text-streak',  accent: 'border-streak/30 bg-streak/5', label: 'Progress' },
  'dsa-patterns.md':  { icon: Code2,         color: 'text-dsa',     accent: 'border-dsa/30 bg-dsa/5',       label: 'DSA Patterns' },
  'job-search.md':    { icon: Briefcase,     color: 'text-jobs',    accent: 'border-jobs/30 bg-jobs/5',     label: 'Job Search' },
  'system-design.md': { icon: Network,       color: 'text-design',  accent: 'border-design/30 bg-design/5', label: 'System Design' },
  'plan.md':          { icon: ClipboardList,  color: 'text-plan',    accent: 'border-plan/30 bg-plan/5',     label: '3-Month Plan' },
  'corrections.md':   { icon: AlertCircle,   color: 'text-warning', accent: 'border-warning/30 bg-warning/5', label: 'Corrections' },
  'ideas.md':         { icon: Lightbulb,     color: 'text-coach',   accent: 'border-coach/30 bg-coach/5',   label: 'Ideas' },
}

/* Custom markdown components for premium rendering */
function makeComponents(accentColor: string): Components {
  return {
    h1: ({ children }) => (
      <div className="mb-4">
        <h1 className="text-xl font-display font-bold text-foreground">{children}</h1>
      </div>
    ),
    h2: ({ children }) => (
      <div className={`flex items-center gap-2 mt-8 mb-3 px-3 py-2 rounded-lg border ${accentColor}`}>
        <ChevronRight className="h-3.5 w-3.5 opacity-50 shrink-0" />
        <h2 className="text-sm font-display font-semibold text-foreground tracking-wide">{children}</h2>
      </div>
    ),
    h3: ({ children }) => (
      <h3 className="text-xs font-display font-semibold text-foreground/60 uppercase tracking-wider mt-5 mb-2 ml-1">{children}</h3>
    ),
    blockquote: ({ children }) => (
      <div className="flex items-start gap-2.5 px-3.5 py-2.5 my-3 rounded-lg bg-coach/5 border border-coach/20">
        <Info className="h-3.5 w-3.5 text-coach shrink-0 mt-0.5" />
        <div className="text-[13px] text-foreground/50 leading-relaxed [&_p]:my-0">{children}</div>
      </div>
    ),
    p: ({ children }) => (
      <p className="text-[13px] text-foreground/75 my-1.5 leading-relaxed">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="space-y-1.5 my-2 ml-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="space-y-1.5 my-2 ml-1 list-decimal list-inside">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-[13px] text-foreground/75 leading-relaxed flex items-start gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-foreground/20 mt-[7px] shrink-0" />
        <span className="flex-1">{children}</span>
      </li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    a: ({ children, href }) => (
      <a href={href} className="text-coach hover:underline">{children}</a>
    ),
    code: ({ children, className }) => {
      if (className) {
        return <code className={className}>{children}</code>
      }
      return (
        <code className="text-coach bg-elevated/80 px-1.5 py-0.5 rounded text-[12px] font-mono">{children}</code>
      )
    },
    hr: () => <div className="my-4" />,
    table: ({ children }) => (
      <div className="my-3 rounded-lg border border-border/40 overflow-hidden">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-elevated/60">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="text-left text-[11px] uppercase tracking-wider font-medium py-2.5 px-3 text-foreground/50 border-b border-border/50 whitespace-nowrap">{children}</th>
    ),
    td: ({ children }) => (
      <td className="py-2 px-3 text-foreground/70 border-b border-border/15 text-[13px]">{children}</td>
    ),
    tr: ({ children }) => (
      <tr className="transition-colors hover:bg-elevated/20">{children}</tr>
    ),
  }
}

export default function MemoryPage() {
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/memory')
      .then(res => res.json())
      .then(data => {
        const fileList = data.files || []
        setFiles(fileList)
        if (fileList.length > 0 && !selectedFile) {
          setSelectedFile(fileList[0])
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedFile) return
    setLoading(true)
    fetch(`/api/memory?file=${encodeURIComponent(selectedFile)}`)
      .then(res => res.json())
      .then(data => setContent(data.content || ''))
      .catch(() => setContent(''))
      .finally(() => setLoading(false))
  }, [selectedFile])

  const meta = FILE_META[selectedFile] || { icon: FileText, color: 'text-muted-foreground', accent: 'border-border bg-elevated/30', label: selectedFile }
  const ActiveIcon = meta.icon

  const lineCount = content.split('\n').length
  const sectionCount = (content.match(/^## /gm) || []).length

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="font-display text-2xl font-bold">Memory</h1>
          <p className="text-muted-foreground text-sm mt-1">Read-only view of your workspace files</p>
        </div>
        {selectedFile && (
          <div className="flex items-center gap-3 text-xs text-dim">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {lineCount} lines</span>
            <span>•</span>
            <span>{sectionCount} sections</span>
          </div>
        )}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* File Sidebar */}
        <div className="w-52 shrink-0 space-y-1 overflow-y-auto py-1">
          {files.map(file => {
            const fm = FILE_META[file] || { icon: FileText, color: 'text-muted-foreground', accent: '', label: file }
            const Icon = fm.icon
            const isActive = selectedFile === file
            return (
              <button
                key={file}
                onClick={() => setSelectedFile(file)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150',
                  isActive
                    ? `bg-surface border border-border ${fm.color} font-medium shadow-md`
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface/50'
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? fm.color : '')} />
                <span className="truncate text-sm">{fm.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content Panel */}
        <Card className="flex-1 border-border bg-surface overflow-hidden flex flex-col min-h-0">
          {/* File header bar */}
          {selectedFile && (
            <CardHeader className="pb-0 pt-3 px-5 shrink-0 border-b border-border/30">
              <CardTitle className="text-sm font-medium flex items-center gap-2 pb-3">
                <ActiveIcon className={cn("h-4 w-4", meta.color)} />
                <span className={cn("font-display", meta.color)}>{meta.label}</span>
                <Badge variant="outline" className="ml-auto text-[10px] font-mono text-dim border-border/40">
                  {selectedFile}
                </Badge>
              </CardTitle>
            </CardHeader>
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-5 py-5 max-w-3xl">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-4 rounded bg-elevated/50 animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
                  ))}
                </div>
              ) : content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={makeComponents(meta.accent)}
                >
                  {content}
                </ReactMarkdown>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a file to view</p>
                    <p className="text-xs text-dim mt-1">Your memory files are read-only</p>
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
